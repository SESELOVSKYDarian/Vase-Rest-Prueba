import { randomInt } from "node:crypto";
import { pool } from "../config/database.js";
import { ErrorHttp } from "../utils/errores.js";
import { leerConfig } from "./cartaConfig.service.js";

/**
 * Cuenta de la mesa y pagos desde el QR. Todos los importes se calculan acá, en el servidor:
 * el celular del cliente solo elige "qué paga", nunca "cuánto".
 */
const ESTADOS_CERRADOS = ["cerrada", "cerrado", "cancelado"];
const VENCE_MINUTOS = 30;
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const aCentavos = (pesos) => Math.round(Number(pesos) * 100);
const aPesos = (centavos) => centavos / 100;

export function nuevoCodigo() {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function mesaPorNumero(numero) {
  const n = Number(numero);
  if (!Number.isInteger(n) || n < 1) throw new ErrorHttp(400, "Mesa inválida");
  const r = await pool.query("select id, numero, zona from mesas where numero = $1 limit 1", [n]);
  if (!r.rows[0]) throw new ErrorHttp(404, "No encontramos esa mesa");
  return r.rows[0];
}

export async function pedidoActivo(mesaId, db = pool) {
  const r = await db.query(
    "select * from pedidos where mesa_id = $1 and estado::text <> all($2::text[]) order by abierto_en desc limit 1",
    [mesaId, ESTADOS_CERRADOS],
  );
  return r.rows[0] ?? null;
}

/** Los pagos que quedaron sin confirmar más de 30 minutos dejan de reservar importe. */
export async function vencerPagosViejos() {
  await pool.query(
    "update pagos_qr set estado = 'vencido' where estado = 'pendiente' and creado_en < now() - ($1 || ' minutes')::interval",
    [String(VENCE_MINUTOS)],
  );
}

/** Qué se pidió, qué está pagado y qué falta, con cada unidad identificable para dividir por plato. */
export async function armarCuenta(pedido, db = pool) {
  const items = (await db.query(
    `select pi.id, pi.cantidad, pi.precio_unitario, pi.subtotal, pi.notas, pi.estado, p.nombre
       from pedido_items pi join productos p on p.id = pi.producto_id
      where pi.pedido_id = $1 order by pi.creado_en`,
    [pedido.id],
  )).rows;
  const pagos = (await db.query(
    "select id, codigo, monto, estado, detalle, metodo, creado_en from pagos_qr where pedido_id = $1 and estado in ('pendiente', 'pagado')",
    [pedido.id],
  )).rows;

  const subtotalItems = items.reduce((s, i) => s + aCentavos(i.subtotal), 0);
  const total = aCentavos(pedido.total);
  const factor = subtotalItems > 0 ? total / subtotalItems : 1; // reparte IVA entre los platos
  const cubiertas = new Set(pagos.flatMap((p) => p.detalle?.unidades ?? []));

  const unidades = [];
  for (const item of items) {
    const n = Math.max(1, Math.round(Number(item.cantidad)));
    const unitario = n === 1 ? aCentavos(item.subtotal) : Math.round((aCentavos(item.subtotal) / n));
    for (let k = 1; k <= n; k++) {
      const clave = `${item.id}:${k}`;
      unidades.push({ clave, itemId: item.id, nombre: item.nombre, notas: item.notas ?? "", importe: aPesos(Math.round(unitario * factor)), cubierta: cubiertas.has(clave) });
    }
  }

  const pagado = pagos.filter((p) => p.estado === "pagado").reduce((s, p) => s + aCentavos(p.monto), 0);
  const reservado = pagos.filter((p) => p.estado === "pendiente").reduce((s, p) => s + aCentavos(p.monto), 0);
  return {
    pedidoId: pedido.id,
    subtotal: Number(pedido.subtotal),
    impuestos: Number(pedido.impuestos),
    total: aPesos(total),
    pagado: aPesos(pagado),
    reservado: aPesos(reservado),
    pendiente: aPesos(Math.max(0, total - pagado - reservado)),
    items: items.map((i) => ({ id: i.id, nombre: i.nombre, cantidad: Number(i.cantidad), precioUnitario: Number(i.precio_unitario), subtotal: Number(i.subtotal), notas: i.notas ?? "", estado: i.estado })),
    unidades,
    pagos: pagos.map((p) => ({ codigo: p.codigo, monto: Number(p.monto), estado: p.estado, metodo: p.metodo })),
  };
}

/**
 * Calcula cuánto paga esta persona según cómo quiera dividir y registra el pago pendiente.
 * `modo`: "todo" (lo que falta), "partes" (una parte de N), "unidades" (platos elegidos), "monto" (importe libre).
 */
export async function crearPago({ mesa, pedido, modo, partes, unidades, monto, propinaPct = 0, metodo }) {
  const config = await leerConfig();
  if (!["transferencia", "mercadopago"].includes(metodo)) throw new ErrorHttp(400, "Elegí cómo querés pagar");
  if (metodo === "transferencia" && !config.pago.alias) throw new ErrorHttp(409, "El local todavía no cargó su alias para recibir transferencias. Pedile la cuenta al mozo.");
  if (!config.propinas.includes(Number(propinaPct))) propinaPct = 0;

  const cuenta = await armarCuenta(pedido);
  if (!cuenta.items.length || cuenta.total <= 0) throw new ErrorHttp(409, "Todavía no hay nada para pagar en esta mesa");
  const pendiente = aCentavos(cuenta.pendiente);
  if (pendiente <= 0) throw new ErrorHttp(409, "La cuenta ya está pagada o con pagos en curso");

  const libres = cuenta.unidades.filter((u) => !u.cubierta);
  let centavos;
  let cubre = [];
  if (modo === "todo") {
    centavos = pendiente;
    cubre = libres.map((u) => u.clave);
  } else if (modo === "partes") {
    const n = Math.round(Number(partes));
    if (!(n >= 2 && n <= 20)) throw new ErrorHttp(400, "Dividí entre 2 y 20 personas");
    centavos = Math.min(pendiente, Math.round(aCentavos(cuenta.total) / n));
  } else if (modo === "unidades") {
    const elegidas = [...new Set(Array.isArray(unidades) ? unidades.map(String) : [])];
    const validas = elegidas.map((c) => libres.find((u) => u.clave === c));
    if (!elegidas.length || validas.some((u) => !u)) throw new ErrorHttp(409, "Alguno de los platos que elegiste ya está pagado. Actualizá la cuenta.");
    cubre = elegidas;
    centavos = elegidas.length === libres.length ? pendiente : Math.min(pendiente, validas.reduce((s, u) => s + aCentavos(u.importe), 0));
  } else if (modo === "monto") {
    centavos = aCentavos(monto);
    if (!(centavos >= 100)) throw new ErrorHttp(400, "El importe mínimo es $ 1");
    if (centavos > pendiente) throw new ErrorHttp(409, `Lo que falta pagar es $ ${aPesos(pendiente)}`);
  } else {
    throw new ErrorHttp(400, "Elegí cómo dividir la cuenta");
  }
  if (!(centavos > 0)) throw new ErrorHttp(409, "No hay nada para pagar");
  const propina = Math.round((centavos * Number(propinaPct)) / 100);

  for (let intento = 0; intento < 5; intento++) {
    try {
      const r = await pool.query(
        `insert into pagos_qr (codigo, pedido_id, mesa_id, metodo, monto, propina, detalle)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb) returning *`,
        [nuevoCodigo(), pedido.id, mesa.id, metodo, aPesos(centavos), aPesos(propina), JSON.stringify({ modo, partes: partes ?? null, unidades: cubre, propinaPct: Number(propinaPct) })],
      );
      return r.rows[0];
    } catch (error) {
      if (error.code !== "23505") throw error; // código repetido: probar otro
    }
  }
  throw new Error("No se pudo generar el comprobante");
}

/**
 * Da por recibido un pago: lo registra como cobro y movimiento de caja, y si la cuenta queda saldada
 * cierra el pedido y libera la mesa. No emite factura fiscal (eso lo hace el local con ARCA).
 */
export async function confirmarPago(pagoId, { usuario = "QR", referenciaMp = null } = {}) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const r = await client.query("select * from pagos_qr where id = $1 for update", [pagoId]);
    const pago = r.rows[0];
    if (!pago) throw new ErrorHttp(404, "No encontramos ese pago");
    if (pago.estado === "pagado") { await client.query("commit"); return { pago, cerrado: false, yaEstabaPagado: true }; }
    if (pago.estado === "rechazado") throw new ErrorHttp(409, "Ese pago fue rechazado");

    await client.query(
      "update pagos_qr set estado = 'pagado', pagado_en = now(), confirmado_por = $2, mp_payment_id = coalesce($3, mp_payment_id) where id = $1",
      [pagoId, usuario, referenciaMp],
    );
    await client.query(
      `insert into pagos (pedido_id, mesa_id, metodo_pago, proveedor_billetera, monto, estado, referencia_pago, idempotency_key, confirmado_en, recibido_por)
       values ($1, $2, 'billetera_virtual', $3, $4, 'pagado', $5, $6, now(), $7) on conflict do nothing`,
      [pago.pedido_id, pago.mesa_id, pago.metodo, pago.monto, pago.codigo, `qr-${pago.codigo}`, usuario],
    );
    await client.query(
      `insert into movimientos_caja (pedido_id, mesa_id, tipo, metodo, importe, motivo, observacion, creado_por)
       values ($1, $2, 'ingreso_no_fiscal', 'billetera_virtual', $3, $4, $5, $6)`,
      [pago.pedido_id, pago.mesa_id, pago.monto, `Pago por QR ${pago.codigo}`, `Medio: ${pago.metodo}`, usuario],
    );
    if (Number(pago.propina) > 0) {
      await client.query(
        `insert into movimientos_caja (pedido_id, mesa_id, tipo, metodo, importe, motivo, creado_por)
         values ($1, $2, 'ingreso_no_fiscal', 'billetera_virtual', $3, $4, $5)`,
        [pago.pedido_id, pago.mesa_id, pago.propina, `Propina por QR ${pago.codigo}`, usuario],
      );
    }

    const pedido = (await client.query("select * from pedidos where id = $1 for update", [pago.pedido_id])).rows[0];
    const pagado = (await client.query("select coalesce(sum(monto), 0) as s from pagos_qr where pedido_id = $1 and estado = 'pagado'", [pago.pedido_id])).rows[0].s;
    const saldada = aCentavos(pagado) >= aCentavos(pedido.total);
    if (saldada) {
      await client.query("update pedidos set estado = 'cerrada', cerrado_en = now() where id = $1", [pedido.id]);
      if (pedido.mesa_id) await client.query("update mesas set estado = 'libre', disponible = true where id = $1", [pedido.mesa_id]);
    }
    await client.query("commit");
    return { pago: { ...pago, estado: "pagado" }, cerrado: saldada, yaEstabaPagado: false };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** Datos del comprobante para mostrar al cliente o al control de salida. */
export async function leerComprobante(codigo) {
  const r = await pool.query(
    `select q.*, m.numero as mesa_numero from pagos_qr q left join mesas m on m.id = q.mesa_id where q.codigo = $1`,
    [String(codigo ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.{4})$/, "$1-$2")],
  );
  return r.rows[0] ?? null;
}

export const formatearComprobante = (f) => ({
  codigo: f.codigo,
  estado: f.estado,
  metodo: f.metodo,
  mesa: f.mesa_numero ?? null,
  monto: Number(f.monto),
  propina: Number(f.propina),
  total: Math.round((Number(f.monto) + Number(f.propina)) * 100) / 100,
  creadoEn: f.creado_en,
  pagadoEn: f.pagado_en,
});
