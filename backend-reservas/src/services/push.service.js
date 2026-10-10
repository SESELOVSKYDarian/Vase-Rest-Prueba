import { pool } from "../config/database.js";
import { ErrorHttp } from "../utils/errores.js";

/**
 * Envío de avisos al celular vía Expo Push (que reparte a Firebase en Android y a APNs en iPhone).
 * Funciona solo con la app instalada (compilación propia con las credenciales del proyecto en Expo):
 * en la web y en Expo Go no hay avisos con la pantalla bloqueada.
 */
const EXPO_PUSH_URL = process.env.EXPO_PUSH_URL || "https://exp.host/--/api/v2/push/send";
const LOTE = 100;

export const esTokenExpo = (token) => /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(String(token ?? ""));

export async function registrarDispositivo(usuarioId, token, plataforma) {
  if (!esTokenExpo(token)) throw new ErrorHttp(400, "Ese token no es válido");
  await pool.query(
    `insert into dispositivos_push (usuario_id, token, plataforma) values ($1, $2, $3)
     on conflict (token) do update set usuario_id = excluded.usuario_id, plataforma = excluded.plataforma, actualizado_en = now()`,
    [usuarioId, token, String(plataforma ?? "").slice(0, 20) || null],
  );
}

export const quitarDispositivo = (token) => pool.query("delete from dispositivos_push where token = $1", [String(token ?? "")]);

/** Arma los mensajes de Expo para cada token (puro, para probarlo sin red). */
export function armarMensajes(tokens, { titulo, cuerpo, data = {} }) {
  return tokens.map((to) => ({
    to,
    title: titulo,
    body: cuerpo,
    data,
    sound: "default",
    priority: "high",
    channelId: "servicio",
    ttl: 600,
  }));
}

/** Tokens que Expo declara muertos (app desinstalada): se borran para no insistir. */
export function tokensMuertos(mensajes, tickets) {
  const muertos = [];
  tickets.forEach((t, i) => {
    if (t?.status === "error" && t.details?.error === "DeviceNotRegistered" && mensajes[i]) muertos.push(mensajes[i].to);
  });
  return muertos;
}

/**
 * Manda un aviso a las personas indicadas (ids de usuario) o a todos los de ciertos roles.
 * Nunca lanza: un aviso que falla no debe romper el servicio.
 */
export async function enviarAviso({ usuarios = [], roles = [], titulo, cuerpo, data }, { fetchImpl = fetch } = {}) {
  try {
    const r = await pool.query(
      `select distinct d.token from dispositivos_push d join usuarios u on u.id = d.usuario_id
        where u.activo and (d.usuario_id = any($1::uuid[]) or u.rol::text = any($2::text[]))`,
      [usuarios, roles],
    );
    const tokens = r.rows.map((f) => f.token);
    if (!tokens.length) return { enviados: 0 };
    let enviados = 0;
    for (let i = 0; i < tokens.length; i += LOTE) {
      const mensajes = armarMensajes(tokens.slice(i, i + LOTE), { titulo, cuerpo, data });
      const headers = { "content-type": "application/json", accept: "application/json" };
      if (process.env.EXPO_ACCESS_TOKEN) headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
      const resp = await fetchImpl(EXPO_PUSH_URL, { method: "POST", headers, body: JSON.stringify(mensajes) });
      if (!resp.ok) { console.warn(`[push] Expo respondió ${resp.status}`); continue; }
      const cuerpoResp = await resp.json();
      const tickets = Array.isArray(cuerpoResp?.data) ? cuerpoResp.data : [];
      enviados += tickets.filter((t) => t?.status === "ok").length;
      const muertos = tokensMuertos(mensajes, tickets);
      if (muertos.length) await pool.query("delete from dispositivos_push where token = any($1::text[])", [muertos]);
    }
    return { enviados };
  } catch (error) {
    console.warn("[push] No se pudo enviar el aviso:", error instanceof Error ? error.message : error);
    return { enviados: 0, error: true };
  }
}

/** Reserva el derecho a avisar una sola vez por evento. */
export async function reclamarAviso(clave) {
  const r = await pool.query("insert into push_enviados (clave) values ($1) on conflict do nothing returning clave", [clave]);
  return r.rowCount > 0;
}
