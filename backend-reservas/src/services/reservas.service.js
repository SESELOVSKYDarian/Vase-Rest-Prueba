import { pool } from "../config/database.js";
import { ErrorHttp } from "../utils/errores.js";
import { fechaArgentina, hhmm } from "./whatsapp/entender.js";

/**
 * Disponibilidad real de mesas: capacidad, reservas que se pisan y mesas ocupadas ahora.
 * Las horas se interpretan en Argentina (UTC-3, sin horario de verano).
 */
export const inicioDe = (fechaIso, hora) => new Date(`${fechaIso}T${hora}:00-03:00`);
const aMin = (hh) => Number(hh.slice(0, 2)) * 60 + Number(hh.slice(3, 5));
const ESTADOS_QUE_OCUPAN = ["pendiente", "confirmada", "activa"];

/** Por qué no se puede reservar a esa hora: { campo, mensaje } (campo = qué dato hay que cambiar), o null si está bien. */
export function problemaDeHorario({ fechaIso, hora, personas }, config, ahora = new Date()) {
  const r = config.reservas;
  if (!r.activas) return { campo: "cerrado", mensaje: "Por ahora no tomamos reservas por este medio. Llamanos o pasá por el local." };
  if (!(personas >= 1)) return { campo: "personas", mensaje: "Decime para cuántas personas es." };
  if (personas > r.maxPersonas) return { campo: "personas", mensaje: `Para más de ${r.maxPersonas} personas coordinamos directo con el local.` };
  if (aMin(hora) < aMin(r.desde) || aMin(hora) > aMin(r.hasta)) return { campo: "hora", mensaje: `Tomamos reservas entre las ${r.desde} y las ${r.hasta}.` };
  const inicio = inicioDe(fechaIso, hora);
  if (inicio.getTime() < ahora.getTime() + r.anticipacionMin * 60000) {
    return { campo: inicio.getTime() < ahora.getTime() ? "fecha" : "hora", mensaje: r.anticipacionMin >= 60 ? `Necesitamos al menos ${Math.round(r.anticipacionMin / 60)} h de anticipación. Probá más tarde o con otro día.` : "Esa hora ya pasó o está muy cerca. Probá con otra." };
  }
  if (inicio.getTime() > ahora.getTime() + 90 * 24 * 3600 * 1000) return { campo: "fecha", mensaje: "Tomamos reservas hasta con 90 días de anticipación." };
  return null;
}

/** Mesas que sirven para esa gente y no están tomadas en ese horario, de la más justa a la más grande. */
export async function mesasDisponibles({ inicio, duracionMin, personas }, db = pool) {
  const fin = new Date(inicio.getTime() + duracionMin * 60000);
  const r = await db.query(
    `select m.id, m.numero, m.capacidad, m.zona, m.estado
       from mesas m
      where m.capacidad >= $3 and m.estado <> 'mantenimiento'
        and not exists (
          select 1 from reservas r where r.mesa_id = m.id and r.estado::text = any($4::text[])
             and r.fecha_hora_inicio < $2 and r.fecha_hora_fin > $1
        )
        and (m.estado = 'libre' or $1::timestamptz >= now() + make_interval(mins => $5))
      order by m.capacidad, m.numero`,
    [inicio, fin, personas, ESTADOS_QUE_OCUPAN, duracionMin],
  );
  return r.rows;
}

/** Horarios cercanos con lugar, para ofrecer cuando el pedido no entra. */
export async function alternativas({ fechaIso, hora, personas }, config, ahora = new Date(), limite = 3) {
  const base = aMin(hora);
  const salida = [];
  for (const delta of [-60, 60, -120, 120, -30, 30, 90, -90]) {
    const minutos = base + delta;
    if (minutos < aMin(config.reservas.desde) || minutos > aMin(config.reservas.hasta)) continue;
    const h = hhmm(minutos);
    if (problemaDeHorario({ fechaIso, hora: h, personas }, config, ahora)) continue;
    const libres = await mesasDisponibles({ inicio: inicioDe(fechaIso, h), duracionMin: config.reservas.duracionMin, personas });
    if (libres.length) salida.push(h);
    if (salida.length >= limite) break;
  }
  return salida.sort();
}

/** Crea el pedido de reserva (queda pendiente hasta que el local la confirme). Evita pisarse con otra en el mismo instante. */
export async function crearReserva({ mesaId = null, fechaIso, hora, personas, nombre, telefono, origen, observaciones = null }, config, ahora = new Date()) {
  const problema = problemaDeHorario({ fechaIso, hora, personas }, config, ahora);
  if (problema) throw new ErrorHttp(409, problema.mensaje);
  const nombreLimpio = String(nombre ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (nombreLimpio.length < 2) throw new ErrorHttp(400, "Necesito un nombre para la reserva.");
  const inicio = inicioDe(fechaIso, hora);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext('reservas'))");
    const libres = await mesasDisponibles({ inicio, duracionMin: config.reservas.duracionMin, personas }, client);
    const mesa = mesaId ? libres.find((m) => m.id === mesaId) : libres[0];
    if (!mesa) throw new ErrorHttp(409, mesaId ? "Esa mesa ya no está libre en ese horario. Elegí otra." : "Ya no queda mesa en ese horario.");
    const fin = new Date(inicio.getTime() + config.reservas.duracionMin * 60000);
    const r = await client.query(
      `insert into reservas (mesa_id, nombre_cliente, telefono, cantidad_personas, fecha_hora_inicio, fecha_hora_fin, estado, observaciones, origen)
       values ($1, $2, $3, $4, $5, $6, 'pendiente', $7, $8) returning *`,
      [mesa.id, nombreLimpio, String(telefono).slice(0, 50), personas, inicio, fin, observaciones, origen ?? null],
    );
    await client.query("commit");
    return { reserva: r.rows[0], mesa };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// ── Enlace corto para elegir la mesa mirando el plano ────────────────────────
// El código es aleatorio (sin letras confusas) y vence a las 3 horas; no sirve como sesión del personal.
const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";
const codigoAleatorio = (n = 8) => Array.from({ length: n }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join("");

export async function firmarEnlace({ telefono, fechaIso, hora, personas, nombre }) {
  await pool.query("delete from reserva_enlaces where expira_en < now()");
  for (let i = 0; i < 5; i++) {
    const codigo = codigoAleatorio();
    const r = await pool.query(
      `insert into reserva_enlaces (codigo, telefono, fecha_iso, hora, personas, nombre, expira_en) values ($1, $2, $3, $4, $5, $6, now() + interval '3 hours') on conflict do nothing returning codigo`,
      [codigo, telefono, fechaIso, hora, personas, nombre || null],
    );
    if (r.rowCount) return codigo;
  }
  throw new Error("No se pudo generar el enlace");
}

export async function leerEnlace(codigo) {
  const c = String(codigo ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!c) return null;
  const r = await pool.query("select * from reserva_enlaces where codigo = $1 and expira_en > now()", [c]);
  const f = r.rows[0];
  return f ? { telefono: f.telefono, fechaIso: f.fecha_iso, hora: f.hora, personas: f.personas, nombre: f.nombre ?? "" } : null;
}

export const hoyYMinutos = (ahora = new Date()) => fechaArgentina(ahora);
