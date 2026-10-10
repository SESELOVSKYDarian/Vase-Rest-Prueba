import crypto from "node:crypto";
import { pool } from "../../config/database.js";
import { agregarItemAPedido } from "../../controllers/pedidos.controller.js";
import { ErrorHttp } from "../../utils/errores.js";
import { leerCatalogo } from "../carta.service.js";
import { leerConfig, precioVigente, totalesDe } from "../cartaConfig.service.js";
import { crearIndice } from "../ia/indice.js";
import { alternativas, crearReserva, firmarEnlace, inicioDe, mesasDisponibles, problemaDeHorario } from "../reservas.service.js";
import { fechaArgentina, sumarDias } from "./entender.js";
import { responder, SESION_VACIA } from "./motor.js";

/**
 * WhatsApp Business (Cloud API de Meta): recibe mensajes por webhook, los pasa por la conversación y contesta.
 * Sin credenciales (WHATSAPP_TOKEN y WHATSAPP_PHONE_ID) no sale nada a Meta: las respuestas se devuelven al
 * simulador y se registran, para poder probar todo el circuito sin cuenta de WhatsApp.
 */
const API = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v21.0";
const SESION_VENCE_HORAS = 3;
const MAX_MENSAJES_HORA = 60;

export const whatsappConfigurado = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
const web = () => (process.env.PUBLIC_WEB_URL || "http://localhost:8081").replace(/\/+$/, "");

/** Solo dígitos, con el 9 de los celulares argentinos normalizado (54911… ↔ 5411…). */
export const normalizarTelefono = (t) => String(t ?? "").replace(/\D/g, "");

/** Valida la firma que Meta agrega a cada aviso (HMAC-SHA256 del cuerpo con el secreto de la app). */
export function firmaValida(cuerpoCrudo, cabecera, secreto = process.env.WHATSAPP_APP_SECRET) {
  if (!secreto) return false;
  const esperado = `sha256=${crypto.createHmac("sha256", secreto).update(cuerpoCrudo).digest("hex")}`;
  const a = Buffer.from(esperado);
  const b = Buffer.from(String(cabecera ?? ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Saca los mensajes de texto del aviso de Meta. Lo que no es texto vuelve con `texto: ""` para contestar que no se lee. */
export function mensajesDeWebhook(cuerpo) {
  const salida = [];
  for (const entrada of cuerpo?.entry ?? []) {
    for (const cambio of entrada?.changes ?? []) {
      const v = cambio?.value ?? {};
      const nombres = new Map((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? ""]));
      for (const m of v.messages ?? []) {
        const texto = m.type === "text" ? m.text?.body ?? "" : m.type === "interactive" ? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "" : m.type === "button" ? m.button?.text ?? "" : "";
        salida.push({ waId: m.id, telefono: normalizarTelefono(m.from), nombrePerfil: nombres.get(m.from) ?? "", texto });
      }
    }
  }
  return salida;
}

/** Manda un texto. Sin credenciales solo lo registra. Nunca lanza. */
export async function enviarTexto(telefono, texto, { fetchImpl = fetch } = {}) {
  await pool.query("insert into whatsapp_mensajes (telefono, direccion, texto) values ($1, 'saliente', $2)", [telefono, texto]).catch(() => {});
  if (!whatsappConfigurado()) { console.log(`[whatsapp] (sin credenciales) → ${telefono}: ${texto.replace(/\n/g, " ⏎ ").slice(0, 120)}`); return { enviado: false, simulado: true }; }
  try {
    const r = await fetchImpl(`${API}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: telefono, type: "text", text: { body: texto, preview_url: true } }),
    });
    if (!r.ok) { console.warn(`[whatsapp] Meta respondió ${r.status}: ${(await r.text()).slice(0, 200)}`); return { enviado: false }; }
    return { enviado: true };
  } catch (error) {
    console.warn("[whatsapp] no se pudo enviar:", error instanceof Error ? error.message : error);
    return { enviado: false };
  }
}

// ── Dependencias reales de la conversación ───────────────────────────────────
async function precios(carrito, config) {
  const ids = carrito.map((l) => l.productoId);
  const filas = (await pool.query("select id, nombre, precio, categoria_id from productos where id = any($1::uuid[])", [ids])).rows;
  const por = new Map(filas.map((p) => [p.id, p]));
  const crudos = carrito.map((l) => {
    const p = por.get(l.productoId);
    return { ...l, nombre: p?.nombre ?? "Plato", subtotal: precioVigente(p ?? { precio: 0 }, config).precio * l.cantidad };
  });
  const suma = crudos.reduce((s, i) => s + i.subtotal, 0);
  const total = totalesDe(suma, config).total;
  const factor = suma > 0 ? total / suma : 1; // reparte el IVA entre los platos para que las líneas sumen el total
  return { items: crudos.map((i) => ({ ...i, subtotal: Math.round(i.subtotal * factor * 100) / 100 })), total };
}

async function pedirLlevar({ nombre, retiroMin, carrito, telefono, config }) {
  const recientes = await pool.query("select count(*)::int as n from pedidos where tipo = 'llevar' and cliente_telefono = $1 and estado in ('pendiente','preparando','listo') and abierto_en > now() - interval '1 hour'", [telefono]);
  if (recientes.rows[0].n >= 3) throw new ErrorHttp(429, "Ya tenés varios pedidos en curso. Esperá a retirarlos o llamá al local.");
  const hoy = fechaArgentina();
  const dia = retiroMin >= 1440 ? sumarDias(hoy.iso, 1) : hoy.iso;
  const m = retiroMin % 1440;
  const retiro = inicioDe(dia, `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  const pedido = (await pool.query(
    `insert into pedidos (mesa_id, usuario_id, estado, subtotal, impuestos, total, tipo, cliente_nombre, cliente_telefono, retiro_para, origen, abierto_en)
     values (null, null, 'pendiente', 0, 0, 0, 'llevar', $1, $2, $3, 'whatsapp', now()) returning id`,
    [nombre, telefono, retiro],
  )).rows[0];
  const omitidos = [];
  let agregados = 0;
  for (const l of carrito) {
    try { await agregarItemAPedido(pedido.id, { productoId: l.productoId, cantidad: l.cantidad, notas: l.notas }); agregados++; }
    catch (error) { omitidos.push(`${(await pool.query("select nombre from productos where id = $1", [l.productoId])).rows[0]?.nombre ?? "un plato"} (${error instanceof ErrorHttp ? error.message : "no disponible"})`); }
  }
  if (!agregados) {
    await pool.query("delete from pedidos where id = $1", [pedido.id]);
    throw new ErrorHttp(409, `Ahora no puedo anotar ninguno de esos platos: ${omitidos.join("; ")}.`);
  }
  const total = Number((await pool.query("select total from pedidos where id = $1", [pedido.id])).rows[0].total);
  void config;
  return { codigo: String(pedido.id).slice(-4).toUpperCase(), total, omitidos };
}

export async function armarContexto({ telefono, nombrePerfil }) {
  const config = await leerConfig();
  const ahora = new Date();
  const indiceCarta = crearIndice(await leerCatalogo());
  return {
    config,
    ahora,
    indice: indiceCarta,
    nombrePerfil,
    linkCarta: `${web()}/carta`,
    problemaDeHorario: (r) => problemaDeHorario(r, config, ahora),
    disponibilidad: async (r) => {
      const libres = await mesasDisponibles({ inicio: inicioDe(r.fechaIso, r.hora), duracionMin: config.reservas.duracionMin, personas: r.personas });
      return { libres, alternativas: libres.length ? [] : await alternativas(r, config, ahora) };
    },
    enlacePlano: async (r) => `${web()}/reservar?t=${await firmarEnlace({ telefono, fechaIso: r.fechaIso, hora: r.hora, personas: r.personas, nombre: nombrePerfil })}`,
    reservar: (r) => crearReserva({ ...r, telefono, origen: "whatsapp" }, config, ahora),
    precios: (carrito) => precios(carrito, config),
    pedirLlevar: (d) => pedirLlevar({ ...d, telefono, config }),
    cancelarReservas: async () => {
      const r = await pool.query(
        "update reservas set estado = 'cancelada' where telefono = $1 and estado::text in ('pendiente','confirmada') and fecha_hora_inicio > now() returning id",
        [telefono],
      );
      return r.rowCount;
    },
  };
}

/**
 * Procesa un mensaje entrante: lo registra una sola vez, avanza la conversación, guarda el estado y contesta.
 * `enviar` permite capturar las respuestas (simulador) en vez de mandarlas a Meta.
 */
export async function procesarEntrante({ telefono, texto, waId = null, nombrePerfil = "" }, { enviar = enviarTexto, contexto = armarContexto } = {}) {
  if (waId) {
    const nuevo = await pool.query("insert into whatsapp_mensajes (telefono, direccion, texto, wa_id) values ($1, 'entrante', $2, $3) on conflict (wa_id) do nothing returning id", [telefono, texto, waId]);
    if (!nuevo.rowCount) return { duplicado: true, respuestas: [] };
  } else {
    await pool.query("insert into whatsapp_mensajes (telefono, direccion, texto) values ($1, 'entrante', $2)", [telefono, texto]);
  }
  const volumen = await pool.query("select count(*)::int as n from whatsapp_mensajes where telefono = $1 and direccion = 'entrante' and creado_en > now() - interval '1 hour'", [telefono]);
  if (volumen.rows[0].n > MAX_MENSAJES_HORA) return { limitado: true, respuestas: [] };

  const fila = (await pool.query(`select estado, datos, actualizado_en > now() - make_interval(hours => $2) as vigente from whatsapp_sesiones where telefono = $1`, [telefono, SESION_VENCE_HORAS])).rows[0];
  const previa = fila?.vigente ? { estado: fila.estado, datos: fila.datos ?? {} } : { ...SESION_VACIA, datos: { nombreGuardado: fila?.datos?.nombreGuardado } };
  const ctx = await contexto({ telefono, nombrePerfil });
  let resultado;
  try {
    resultado = await responder(previa, texto, ctx);
  } catch (error) {
    console.error("[whatsapp] la conversación falló:", error);
    resultado = { sesion: previa, respuestas: ["Uy, algo salió mal de mi lado. 🙏 Probá de nuevo en un ratito o escribí *menu*."] };
  }
  await pool.query(
    `insert into whatsapp_sesiones (telefono, estado, datos, actualizado_en) values ($1, $2, $3::jsonb, now())
     on conflict (telefono) do update set estado = excluded.estado, datos = excluded.datos, actualizado_en = now()`,
    [telefono, resultado.sesion.estado, JSON.stringify(resultado.sesion.datos ?? {})],
  );
  for (const r of resultado.respuestas) await enviar(telefono, r);
  return { respuestas: resultado.respuestas, estado: resultado.sesion.estado };
}

