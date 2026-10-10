import { Router } from "express";
import { pool } from "../config/database.js";
import { leerConfig } from "../services/cartaConfig.service.js";
import { construirCartaPublica, leerCatalogo, populares } from "../services/carta.service.js";
import { crearIndice } from "../services/ia/indice.js";
import { pedirJson } from "../services/ia/llm.js";
import { recomendar } from "../services/ia/nlu.local.js";
import { crearPreferencia, firmaValida, leerPagoMp, mpConfigurado } from "../services/mercadopago.service.js";
import { armarCuenta, confirmarPago, crearPago, formatearComprobante, leerComprobante, mesaPorNumero, pedidoActivo, vencerPagosViejos } from "../services/qr.service.js";
import { armarTicket, validarPedidoFactura } from "../services/factura.service.js";
import { crearReserva, inicioDe, leerEnlace, mesasDisponibles } from "../services/reservas.service.js";
import { enviarTexto } from "../services/whatsapp/whatsapp.service.js";
import { fechaLegible } from "../services/whatsapp/entender.js";
import { fechaArgentina } from "../services/whatsapp/entender.js";
import { ErrorHttp, responderError } from "../utils/errores.js";
import { limitar } from "../utils/limitar.js";

/**
 * Endpoints públicos (sin sesión) para lo que ve el cliente desde el QR de su mesa: la carta,
 * pedir (el mozo confirma), la cuenta, pagar y el comprobante. Todo importe se calcula acá.
 */
const router = Router();
const lectura = limitar({ nombre: "lectura", ventanaMs: 60_000, max: 120 });
const escritura = limitar({ nombre: "escritura", ventanaMs: 60_000, max: 20 });
const asistente = limitar({ nombre: "asistente", ventanaMs: 60_000, max: 12 });

const IDIOMAS = ["es", "en", "pt"];

router.get("/carta", lectura, async (req, res) => {
  try {
    const idioma = IDIOMAS.includes(String(req.query.lang)) ? String(req.query.lang) : "es";
    const carta = await construirCartaPublica({ idioma });
    res.setHeader("Cache-Control", "public, max-age=20");
    res.json(carta);
  } catch (error) {
    responderError(res, error, "No se pudo cargar la carta");
  }
});

/** "¿Qué me recomendás?": entiende gustos en texto (o dictado) y sugiere platos de la carta real. */
router.post("/asistente", asistente, async (req, res) => {
  try {
    const texto = String(req.body?.texto ?? "").trim().slice(0, 400);
    const idioma = IDIOMAS.includes(String(req.body?.idioma)) ? String(req.body.idioma) : "es";
    if (texto.length < 2) throw new ErrorHttp(400, "Contame qué te gusta");
    const catalogo = await leerCatalogo();
    const indice = crearIndice(catalogo);
    const local = recomendar(texto, indice, { populares: await populares() });

    let mensaje = null;
    let ids = local.ids;
    let fuente = "local";
    // Con IA gratuita configurada, la redacción y la elección son más naturales, pero siempre se
    // limitan a platos que cumplen las restricciones (sin TACC, vegano…) y que existen en la carta.
    const ia = local.sinResultados && local.permitidos.length === 0 ? null : await pedirJson({
      sistema: `Sos el sommelier de un restaurante argentino. Recomendá hasta 4 platos DE ESTA CARTA según lo que cuenta la persona. Usá solo los ids que figuran en la carta. Respetá restricciones solo si el plato tiene la etiqueta correspondiente; no inventes ingredientes ni alérgenos. Respondé en ${idioma === "en" ? "inglés" : idioma === "pt" ? "portugués" : "español rioplatense"}, en una o dos frases cálidas. Formato: {"mensaje": string, "ids": string[]}`,
      usuario: JSON.stringify({
        pedido: texto,
        carta: catalogo.productos.filter((p) => p.disponible && local.permitidos.includes(p.id)).map((p) => ({ id: p.id, nombre: p.nombre, descripcion: p.descripcion, etiquetas: p.etiquetas, precio: p.precio })),
      }),
      maxTokens: 500,
    });
    if (ia && Array.isArray(ia.ids)) {
      const validos = ia.ids.filter((id) => local.permitidos.includes(id)).slice(0, 4);
      if (validos.length) { ids = validos; mensaje = typeof ia.mensaje === "string" ? ia.mensaje.slice(0, 400) : null; fuente = "ia"; }
    }
    res.json({ entendido: local.entendido, conceptos: local.conceptos, evita: local.evita, presupuesto: local.presupuesto, sinResultados: ids.length === 0, faltanEtiquetas: local.faltanEtiquetas, ids, motivos: local.motivos, mensaje, fuente });
  } catch (error) {
    responderError(res, error, "No se pudo armar la recomendación");
  }
});

/** Estado de la mesa: cuenta, qué falta pagar y cómo se puede pagar. */
router.get("/mesa/:numero", lectura, async (req, res) => {
  try {
    await vencerPagosViejos();
    const mesa = await mesaPorNumero(req.params.numero);
    const [config, pedido] = await Promise.all([leerConfig(), pedidoActivo(mesa.id)]);
    const pendientes = await pool.query("select count(*)::int as n from solicitudes_mesa where mesa_id = $1 and estado = 'pendiente'", [mesa.id]);
    res.json({
      mesa: { numero: mesa.numero, zona: mesa.zona },
      cuenta: pedido ? await armarCuenta(pedido) : null,
      pago: {
        transferencia: Boolean(config.pago.alias),
        alias: config.pago.alias,
        titular: config.pago.titular,
        mensaje: config.pago.mensaje,
        mercadopago: mpConfigurado(),
      },
      propinas: config.propinas,
      ivaIncluido: config.ivaIncluido,
      pedidosQr: config.pedidosQr,
      solicitudesPendientes: pendientes.rows[0].n,
    });
  } catch (error) {
    responderError(res, error, "No se pudo cargar la mesa");
  }
});

/** Pedir desde el celular: queda como solicitud; el mozo la confirma antes de que llegue a cocina. */
router.post("/mesa/:numero/solicitud", escritura, async (req, res) => {
  try {
    const mesa = await mesaPorNumero(req.params.numero);
    const config = await leerConfig();
    const tipo = String(req.body?.tipo ?? "pedido");
    if (!["pedido", "mozo", "cuenta"].includes(tipo)) throw new ErrorHttp(400, "Solicitud inválida");
    if (tipo === "pedido" && !config.pedidosQr) throw new ErrorHttp(403, "Este local toma los pedidos con el mozo");
    const nota = String(req.body?.nota ?? "").trim().slice(0, 200);

    let items = [];
    if (tipo === "pedido") {
      const crudos = Array.isArray(req.body?.items) ? req.body.items.slice(0, 30) : [];
      const ids = [...new Set(crudos.map((i) => String(i?.productoId)))];
      const existentes = await pool.query("select id, nombre, disponible from productos where id::text = any($1::text[]) and coalesce(activo, true)", [ids]);
      const porId = new Map(existentes.rows.map((p) => [p.id, p]));
      items = crudos.map((i) => ({
        productoId: String(i?.productoId),
        cantidad: Math.min(20, Math.max(1, Math.round(Number(i?.cantidad) || 1))),
        notas: String(i?.notas ?? "").trim().slice(0, 140),
      }));
      if (!items.length) throw new ErrorHttp(400, "Elegí al menos un plato");
      for (const i of items) {
        const p = porId.get(i.productoId);
        if (!p) throw new ErrorHttp(404, "Uno de los platos ya no está en la carta");
        if (p.disponible === false) throw new ErrorHttp(409, `${p.nombre} está agotado`);
      }
    }
    const abiertas = await pool.query("select count(*)::int as n from solicitudes_mesa where mesa_id = $1 and estado = 'pendiente'", [mesa.id]);
    if (abiertas.rows[0].n >= 6) throw new ErrorHttp(429, "Ya hay varios pedidos esperando al mozo. Esperá un momento.");

    const r = await pool.query(
      "insert into solicitudes_mesa (mesa_id, tipo, items, nota) values ($1, $2, $3::jsonb, $4) returning id, creada_en",
      [mesa.id, tipo, JSON.stringify(items), nota || null],
    );
    res.status(201).json({ id: r.rows[0].id, tipo, mensaje: tipo === "pedido" ? "Se lo avisamos al mozo para que lo confirme" : "Avisamos al mozo" });
  } catch (error) {
    responderError(res, error, "No se pudo enviar la solicitud");
  }
});

/** Pagar: arma el pago (importe calculado acá) y devuelve cómo completarlo. */
router.post("/mesa/:numero/pago", escritura, async (req, res) => {
  try {
    await vencerPagosViejos();
    const mesa = await mesaPorNumero(req.params.numero);
    const pedido = await pedidoActivo(mesa.id);
    if (!pedido) throw new ErrorHttp(409, "Esta mesa no tiene una cuenta abierta");
    const b = req.body ?? {};
    const pago = await crearPago({ mesa, pedido, modo: b.modo, partes: b.partes, unidades: b.unidades, monto: b.monto, propinaPct: Number(b.propina ?? 0), metodo: b.metodo });
    const total = Math.round((Number(pago.monto) + Number(pago.propina)) * 100) / 100;
    const config = await leerConfig();

    let link = null;
    if (pago.metodo === "mercadopago") {
      if (!mpConfigurado()) {
        await pool.query("update pagos_qr set estado = 'rechazado' where id = $1", [pago.id]);
        throw new ErrorHttp(503, "Mercado Pago todavía no está configurado en este local");
      }
      try {
        const web = String(process.env.PUBLIC_WEB_URL ?? "").replace(/\/+$/, "");
        const preferencia = await crearPreferencia({ codigo: pago.codigo, titulo: `${config.nombreLocal || "Cuenta"} · mesa ${mesa.numero}`, total, volverA: web ? `${web}/carta?mesa=${mesa.numero}&pago=${pago.codigo}` : null });
        link = preferencia.link;
        await pool.query("update pagos_qr set mp_preference_id = $2, detalle = detalle || $3::jsonb where id = $1", [pago.id, preferencia.id, JSON.stringify({ link })]);
      } catch (error) {
        await pool.query("update pagos_qr set estado = 'rechazado' where id = $1", [pago.id]);
        console.error("[mercadopago]", error.message);
        throw new ErrorHttp(502, "No pudimos abrir Mercado Pago. Probá con transferencia o pedile la cuenta al mozo.");
      }
    }
    res.status(201).json({
      codigo: pago.codigo,
      estado: pago.estado,
      metodo: pago.metodo,
      monto: Number(pago.monto),
      propina: Number(pago.propina),
      total,
      ...(pago.metodo === "transferencia" ? { transferencia: { alias: config.pago.alias, titular: config.pago.titular, mensaje: config.pago.mensaje } } : { link }),
    });
  } catch (error) {
    responderError(res, error, "No se pudo iniciar el pago");
  }
});

/** Estado del pago y comprobante. El cliente lo consulta hasta que el local confirma. */
router.get("/pago/:codigo", lectura, async (req, res) => {
  try {
    await vencerPagosViejos();
    const fila = await leerComprobante(req.params.codigo);
    if (!fila) throw new ErrorHttp(404, "No encontramos ese comprobante");
    const config = await leerConfig();
    const resena = await pool.query("select estrellas from resenas where pago_id = $1 limit 1", [fila.id]);
    res.json({
      ...formatearComprobante(fila),
      local: config.nombreLocal,
      reseniaEnviada: Boolean(resena.rows[0]),
      ...(fila.estado === "pendiente" && fila.metodo === "transferencia" ? { transferencia: { alias: config.pago.alias, titular: config.pago.titular, mensaje: config.pago.mensaje } } : {}),
      ...(fila.estado === "pendiente" && fila.metodo === "mercadopago" ? { link: fila.detalle?.link ?? null } : {}),
    });
  } catch (error) {
    responderError(res, error, "No se pudo leer el comprobante");
  }
});

async function datosTicket(codigo) {
  const fila = await leerComprobante(codigo);
  if (!fila) throw new ErrorHttp(404, "No encontramos ese comprobante");
  if (fila.estado !== "pagado") throw new ErrorHttp(409, "El ticket está disponible cuando el local confirma el pago");
  const pedido = (await pool.query("select * from pedidos where id = $1", [fila.pedido_id])).rows[0];
  const cuenta = await armarCuenta(pedido);
  const config = await leerConfig();
  const sol = (await pool.query("select * from solicitudes_factura where pago_id = $1", [fila.id])).rows[0];
  const factura = sol
    ? { estado: sol.estado, tipo: sol.tipo_comprobante, nombre: sol.nombre, numero: sol.estado === "emitida" ? sol.numero_factura : null, motivo: sol.estado === "rechazada" ? sol.nota_local ?? "" : "" }
    : null;
  return { fila, config, ticket: armarTicket({ pago: fila, cuenta, config, mesaNumero: fila.mesa_numero, factura }) };
}

/** Ticket (no fiscal) de un pago confirmado, listo para mostrar o imprimir. */
router.get("/pago/:codigo/ticket", lectura, async (req, res) => {
  try {
    res.json((await datosTicket(req.params.codigo)).ticket);
  } catch (error) {
    responderError(res, error, "No se pudo armar el ticket");
  }
});

/**
 * El cliente pide factura con sus datos. Queda en la bandeja del local, que la emite en ARCA con sus
 * propias credenciales y deja el número acá. Este sistema no genera CAE ni números de factura.
 */
router.post("/pago/:codigo/factura", escritura, async (req, res) => {
  try {
    const { fila, config } = await datosTicket(req.params.codigo);
    if (config.fiscal?.pedirFactura === false) throw new ErrorHttp(409, "Este local no recibe pedidos de factura por acá. Consultá en caja.");
    const { datos, error } = validarPedidoFactura(req.body, config.fiscal?.condicionIva);
    if (error) throw new ErrorHttp(400, error);
    const previa = await pool.query("select estado from solicitudes_factura where pago_id = $1", [fila.id]);
    if (previa.rows[0] && previa.rows[0].estado !== "rechazada") throw new ErrorHttp(409, "Ya pediste la factura de este pago.");
    await pool.query(
      `insert into solicitudes_factura (pago_id, tipo_comprobante, condicion_iva, doc_tipo, doc_numero, nombre, email, domicilio)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (pago_id) do update set tipo_comprobante = excluded.tipo_comprobante, condicion_iva = excluded.condicion_iva,
         doc_tipo = excluded.doc_tipo, doc_numero = excluded.doc_numero, nombre = excluded.nombre, email = excluded.email,
         domicilio = excluded.domicilio, estado = 'pendiente', nota_local = null, creada_en = now()`,
      [fila.id, datos.tipoComprobante, datos.condicionIva, datos.docTipo, datos.docNumero, datos.nombre, datos.email, datos.domicilio || null],
    );
    res.status(201).json({ ok: true, tipo: datos.tipoComprobante });
  } catch (error) {
    responderError(res, error, "No se pudo registrar el pedido de factura");
  }
});

/**
 * Elegir mesa mirando el plano real: el enlace que manda el asistente de WhatsApp lleva firmados el día,
 * la hora y la cantidad. Devuelve el plano y qué mesas están libres para ese horario.
 */
router.get("/reservar", lectura, async (req, res) => {
  try {
    const datos = await leerEnlace(req.query.t);
    if (!datos) throw new ErrorHttp(410, "Este enlace venció. Volvé a pedir tu reserva por WhatsApp.");
    const config = await leerConfig();
    const duracionMin = config.reservas.duracionMin;
    const libres = new Set((await mesasDisponibles({ inicio: inicioDe(datos.fechaIso, datos.hora), duracionMin, personas: datos.personas })).map((m) => m.id));
    const [mesas, plano] = await Promise.all([
      pool.query("select id, numero, capacidad, zona, forma, pos_x, pos_y, estado from mesas where estado <> 'mantenimiento' order by numero"),
      pool.query("select payload from salon_layouts where id = 'plano-v2'"),
    ]);
    res.json({
      local: config.nombreLocal,
      pedido: { fechaIso: datos.fechaIso, hora: datos.hora, personas: datos.personas, cuando: `${fechaLegible(datos.fechaIso, fechaArgentina())} a las ${datos.hora}`, nombre: datos.nombre },
      duracionMin,
      plano: plano.rows[0]?.payload ?? null,
      mesas: mesas.rows.map((m) => ({
        id: m.id, numero: m.numero, capacidad: m.capacidad, zona: m.zona, forma: m.forma,
        posX: Number(m.pos_x) || 0, posY: Number(m.pos_y) || 0,
        libre: libres.has(m.id),
        motivo: libres.has(m.id) ? null : m.capacidad < datos.personas ? "chica" : "ocupada",
      })),
    });
  } catch (error) {
    responderError(res, error, "No se pudo cargar el plano");
  }
});

router.post("/reservar", escritura, async (req, res) => {
  try {
    const datos = await leerEnlace(req.body?.t);
    if (!datos) throw new ErrorHttp(410, "Este enlace venció. Volvé a pedir tu reserva por WhatsApp.");
    const config = await leerConfig();
    const mesaId = String(req.body?.mesaId ?? "");
    const nombre = String(req.body?.nombre ?? datos.nombre ?? "");
    const { reserva, mesa } = await crearReserva({ mesaId, fechaIso: datos.fechaIso, hora: datos.hora, personas: datos.personas, nombre, telefono: datos.telefono, origen: "whatsapp" }, config);
    // La conversación de WhatsApp queda lista para lo próximo: la reserva ya se hizo desde el plano.
    await pool.query("update whatsapp_sesiones set estado = 'inicio', datos = datos - 'reserva' where telefono = $1", [datos.telefono]);
    // Se confirma por el mismo chat, así la persona no tiene que volver a abrir nada.
    void enviarTexto(datos.telefono, `¡Listo, ${reserva.nombre_cliente}! ✅ Pedí tu reserva: *mesa ${mesa.numero}*, ${fechaLegible(datos.fechaIso, fechaArgentina())} a las ${datos.hora}, ${datos.personas} ${datos.personas === 1 ? "persona" : "personas"}.\n\nEl local la confirma en breve y te aviso por acá.`);
    res.status(201).json({ ok: true, mesa: mesa.numero, estado: "pendiente" });
  } catch (error) {
    responderError(res, error, "No se pudo reservar");
  }
});

/** El cliente cancela un pago que no va a hacer (libera el importe reservado). */
router.post("/pago/:codigo/cancelar", escritura, async (req, res) => {
  try {
    const fila = await leerComprobante(req.params.codigo);
    if (!fila) throw new ErrorHttp(404, "No encontramos ese comprobante");
    if (fila.estado !== "pendiente") throw new ErrorHttp(409, "Ese pago ya no se puede cancelar");
    await pool.query("update pagos_qr set estado = 'rechazado' where id = $1 and estado = 'pendiente'", [fila.id]);
    res.json({ ok: true });
  } catch (error) {
    responderError(res, error, "No se pudo cancelar el pago");
  }
});

/** Reseña después de pagar: una por comprobante. */
router.post("/pago/:codigo/resena", escritura, async (req, res) => {
  try {
    const fila = await leerComprobante(req.params.codigo);
    if (!fila || fila.estado !== "pagado") throw new ErrorHttp(409, "Primero tiene que estar pagado");
    const estrellas = Math.round(Number(req.body?.estrellas));
    if (!(estrellas >= 1 && estrellas <= 5)) throw new ErrorHttp(400, "Elegí de 1 a 5 estrellas");
    const comentario = String(req.body?.comentario ?? "").trim().slice(0, 500);
    const previa = await pool.query("select 1 from resenas where pago_id = $1", [fila.id]);
    if (previa.rowCount) throw new ErrorHttp(409, "Ya dejaste tu reseña. ¡Gracias!");
    await pool.query("insert into resenas (pago_id, mesa_id, estrellas, comentario) values ($1, $2, $3, $4)", [fila.id, fila.mesa_id, estrellas, comentario || null]);
    res.status(201).json({ ok: true });
  } catch (error) {
    responderError(res, error, "No se pudo guardar la reseña");
  }
});

/** Aviso de Mercado Pago: se confirma el pago consultándolo a Mercado Pago (nunca por lo que diga el aviso). */
router.post("/mp/webhook", async (req, res) => {
  try {
    if (!mpConfigurado()) return res.status(204).end();
    const idPago = req.body?.data?.id ?? req.query["data.id"] ?? req.query.id;
    const tipo = req.body?.type ?? req.query.type ?? req.query.topic;
    if (!idPago || tipo !== "payment") return res.status(204).end();
    if (!firmaValida(req, idPago)) return res.status(401).json({ mensaje: "Firma inválida" });
    const mp = await leerPagoMp(idPago);
    const fila = mp.external_reference ? await leerComprobante(mp.external_reference) : null;
    if (fila && mp.status === "approved") {
      const esperado = Math.round((Number(fila.monto) + Number(fila.propina)) * 100);
      if (Math.round(Number(mp.transaction_amount) * 100) >= esperado) await confirmarPago(fila.id, { usuario: "Mercado Pago", referenciaMp: String(mp.id) });
      else console.warn(`[mercadopago] importe menor al esperado en ${fila.codigo}`);
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[mercadopago] webhook", error.message);
    res.status(500).json({ mensaje: "No se pudo procesar el aviso" });
  }
});

export default router;
