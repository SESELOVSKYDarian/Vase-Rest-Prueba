import { Router } from "express";
import { requireAuth } from "../controllers/auth.controller.js";
import { agregarItemAPedido } from "../controllers/pedidos.controller.js";
import { pool } from "../config/database.js";
import { confirmarPago, formatearComprobante, leerComprobante, pedidoActivo, vencerPagosViejos } from "../services/qr.service.js";
import { obtenerUsuarioRequest } from "../utils/authz.js";
import { ErrorHttp, responderError } from "../utils/errores.js";

/**
 * Lo que el salón tiene que atender: pedidos y llamados que llegan desde el QR, transferencias por
 * confirmar y el control de salida. Todo exige sesión del personal.
 */
const router = Router();
router.use(requireAuth);

const ROLES = new Set(["admin", "encargado", "cajero", "mozo"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function exigirPersonal(req) {
  const usuario = obtenerUsuarioRequest(req);
  if (!ROLES.has(usuario.rol)) throw new ErrorHttp(403, "Tu usuario no puede atender el salón");
  return usuario;
}
const idValido = (id) => { if (!UUID.test(String(id))) throw new ErrorHttp(400, "Identificador inválido"); return String(id); };

router.get("/", async (req, res) => {
  try {
    exigirPersonal(req);
    await vencerPagosViejos();
    const [solicitudes, pagos, facturas] = await Promise.all([
      pool.query(
        `select s.id, s.tipo, s.items, s.nota, s.creada_en, m.numero as mesa, m.id as mesa_id
           from solicitudes_mesa s join mesas m on m.id = s.mesa_id where s.estado = 'pendiente' order by s.creada_en`,
      ),
      pool.query(
        `select q.id, q.codigo, q.metodo, q.monto, q.propina, q.creado_en, m.numero as mesa
           from pagos_qr q left join mesas m on m.id = q.mesa_id where q.estado = 'pendiente' and q.metodo = 'transferencia' order by q.creado_en`,
      ),
      pool.query(
        `select f.*, q.codigo, q.monto, q.propina, q.pagado_en, m.numero as mesa
           from solicitudes_factura f join pagos_qr q on q.id = f.pago_id left join mesas m on m.id = q.mesa_id
          where f.estado = 'pendiente' order by f.creada_en`,
      ),
    ]);
    const ids = [...new Set(solicitudes.rows.flatMap((s) => s.items.map((i) => i.productoId)))];
    const nombres = new Map((await pool.query("select id, nombre from productos where id::text = any($1::text[])", [ids])).rows.map((p) => [p.id, p.nombre]));
    res.json({
      solicitudes: solicitudes.rows.map((s) => ({
        id: s.id,
        tipo: s.tipo,
        mesa: s.mesa,
        mesaId: s.mesa_id,
        nota: s.nota ?? "",
        creadaEn: s.creada_en,
        items: s.items.map((i) => ({ productoId: i.productoId, nombre: nombres.get(i.productoId) ?? "Plato", cantidad: i.cantidad, notas: i.notas ?? "" })),
      })),
      pagos: pagos.rows.map((p) => ({ id: p.id, codigo: p.codigo, metodo: p.metodo, mesa: p.mesa, monto: Number(p.monto), propina: Number(p.propina), total: Math.round((Number(p.monto) + Number(p.propina)) * 100) / 100, creadoEn: p.creado_en })),
      facturas: facturas.rows.map((f) => ({
        id: f.id, codigo: f.codigo, mesa: f.mesa, tipo: f.tipo_comprobante, condicionIva: f.condicion_iva, docTipo: f.doc_tipo, docNumero: f.doc_numero,
        nombre: f.nombre, email: f.email ?? "", domicilio: f.domicilio ?? "", importe: Math.round((Number(f.monto) + Number(f.propina)) * 100) / 100, importeNeto: Number(f.monto), creadaEn: f.creada_en,
      })),
    });
  } catch (error) {
    responderError(res, error, "No se pudieron cargar los avisos");
  }
});

/** Acepta lo que pidió la mesa: abre (o retoma) el pedido y agrega los platos; cocina lo ve al instante. */
router.post("/solicitudes/:id/aceptar", async (req, res) => {
  const client = await pool.connect();
  try {
    const usuario = exigirPersonal(req);
    const id = idValido(req.params.id);
    const marcada = await client.query(
      "update solicitudes_mesa set estado = 'aceptada', resuelta_en = now(), resuelta_por = $2 where id = $1 and estado = 'pendiente' returning *",
      [id, usuario.nombre || usuario.rol],
    );
    const solicitud = marcada.rows[0];
    if (!solicitud) throw new ErrorHttp(409, "Otro mozo ya atendió esta solicitud");
    if (solicitud.tipo !== "pedido") return res.json({ ok: true, agregados: [], omitidos: [] });

    let pedido = await pedidoActivo(solicitud.mesa_id);
    if (!pedido) {
      const usuarioId = UUID.test(usuario.id) ? usuario.id : null;
      pedido = (await pool.query(
        "insert into pedidos (mesa_id, usuario_id, estado, subtotal, impuestos, total, abierto_en) values ($1, $2, 'pendiente', 0, 0, 0, now()) returning *",
        [solicitud.mesa_id, usuarioId],
      )).rows[0];
    } else if (["listo", "lista_para_cobrar", "entregado"].includes(pedido.estado)) {
      await pool.query("update pedidos set estado = 'pendiente' where id = $1", [pedido.id]); // cocina vuelve a verlo
    }
    await pool.query("update mesas set estado = 'esperando_pedido', disponible = false where id = $1", [solicitud.mesa_id]);

    const agregados = [];
    const omitidos = [];
    for (const item of solicitud.items) {
      try {
        await agregarItemAPedido(pedido.id, { productoId: item.productoId, cantidad: item.cantidad, notas: item.notas });
        agregados.push(item.productoId);
      } catch (error) {
        omitidos.push({ productoId: item.productoId, motivo: error instanceof ErrorHttp ? error.message : "No se pudo agregar" });
      }
    }
    res.json({ ok: true, pedidoId: pedido.id, agregados, omitidos });
  } catch (error) {
    responderError(res, error, "No se pudo aceptar la solicitud");
  } finally {
    client.release();
  }
});

router.post("/solicitudes/:id/rechazar", async (req, res) => {
  try {
    const usuario = exigirPersonal(req);
    const r = await pool.query(
      "update solicitudes_mesa set estado = 'rechazada', resuelta_en = now(), resuelta_por = $2 where id = $1 and estado = 'pendiente' returning id",
      [idValido(req.params.id), usuario.nombre || usuario.rol],
    );
    if (!r.rowCount) throw new ErrorHttp(409, "Otro mozo ya atendió esta solicitud");
    res.json({ ok: true });
  } catch (error) {
    responderError(res, error, "No se pudo rechazar la solicitud");
  }
});

/** El mozo o la caja confirma que la transferencia llegó: se registra el cobro y se emite el comprobante. */
router.post("/pagos/:id/confirmar", async (req, res) => {
  try {
    const usuario = exigirPersonal(req);
    const resultado = await confirmarPago(idValido(req.params.id), { usuario: usuario.nombre || usuario.rol });
    res.json({ ok: true, cerrado: resultado.cerrado, codigo: resultado.pago.codigo });
  } catch (error) {
    responderError(res, error, "No se pudo confirmar el pago");
  }
});

router.post("/pagos/:id/rechazar", async (req, res) => {
  try {
    exigirPersonal(req);
    const r = await pool.query("update pagos_qr set estado = 'rechazado' where id = $1 and estado = 'pendiente' returning id", [idValido(req.params.id)]);
    if (!r.rowCount) throw new ErrorHttp(409, "Ese pago ya no está pendiente");
    res.json({ ok: true });
  } catch (error) {
    responderError(res, error, "No se pudo rechazar el pago");
  }
});

/** El local ya emitió la factura en ARCA: deja constancia del número real que le dio (nunca se inventa uno). */
router.post("/facturas/:id/emitida", async (req, res) => {
  try {
    const usuario = exigirPersonal(req);
    const numero = String(req.body?.numero ?? "").trim().slice(0, 30);
    if (!/^\d{1,5}-\d{1,8}$/.test(numero)) throw new ErrorHttp(400, "Escribí el número como lo emitió ARCA, por ejemplo 0001-00000123");
    const r = await pool.query(
      "update solicitudes_factura set estado = 'emitida', numero_factura = $2, emitida_en = now(), emitida_por = $3 where id = $1 and estado = 'pendiente' returning id",
      [idValido(req.params.id), numero, usuario.nombre || usuario.rol],
    );
    if (!r.rowCount) throw new ErrorHttp(409, "Esa factura ya fue atendida");
    res.json({ ok: true });
  } catch (error) {
    responderError(res, error, "No se pudo marcar la factura");
  }
});

router.post("/facturas/:id/rechazar", async (req, res) => {
  try {
    exigirPersonal(req);
    const motivo = String(req.body?.motivo ?? "").trim().slice(0, 200);
    const r = await pool.query("update solicitudes_factura set estado = 'rechazada', nota_local = $2 where id = $1 and estado = 'pendiente' returning id", [idValido(req.params.id), motivo || "Revisá tus datos y volvé a pedirla."]);
    if (!r.rowCount) throw new ErrorHttp(409, "Esa factura ya fue atendida");
    res.json({ ok: true });
  } catch (error) {
    responderError(res, error, "No se pudo rechazar el pedido");
  }
});

/**
 * Control de salida: quien está en la puerta escanea el QR del comprobante (o escribe el código).
 * Devuelve si está pagado y cuántas veces se mostró; el primer control queda registrado.
 */
router.get("/salida/:codigo", async (req, res) => {
  try {
    const usuario = exigirPersonal(req);
    const fila = await leerComprobante(req.params.codigo);
    if (!fila) return res.json({ valido: false, motivo: "no_existe" });
    if (fila.estado !== "pagado") return res.json({ valido: false, motivo: fila.estado, comprobante: formatearComprobante(fila) });
    const previas = fila.salida_verificaciones;
    const actualizado = await pool.query(
      `update pagos_qr set salida_verificaciones = salida_verificaciones + 1,
              salida_verificada_en = coalesce(salida_verificada_en, now()),
              salida_verificada_por = coalesce(salida_verificada_por, $2)
        where id = $1 returning salida_verificada_en, salida_verificada_por`,
      [fila.id, usuario.nombre || usuario.rol],
    );
    res.json({
      valido: true,
      repetido: previas > 0,
      primeraVez: actualizado.rows[0].salida_verificada_en,
      verificadoPor: actualizado.rows[0].salida_verificada_por,
      comprobante: formatearComprobante(fila),
    });
  } catch (error) {
    responderError(res, error, "No se pudo verificar el comprobante");
  }
});

/** Últimos comprobantes pagados (para encontrar uno cuando el cliente no puede mostrar el QR). */
router.get("/salida", async (req, res) => {
  try {
    exigirPersonal(req);
    const r = await pool.query(
      `select q.*, m.numero as mesa_numero from pagos_qr q left join mesas m on m.id = q.mesa_id
        where q.estado = 'pagado' and q.pagado_en > now() - interval '12 hours' order by q.pagado_en desc limit 40`,
    );
    res.json({ comprobantes: r.rows.map((f) => ({ ...formatearComprobante(f), verificado: f.salida_verificaciones > 0 })) });
  } catch (error) {
    responderError(res, error, "No se pudo cargar la lista");
  }
});

export default router;
