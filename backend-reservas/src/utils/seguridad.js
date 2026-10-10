import { requireAuth } from "../controllers/auth.controller.js";
import { obtenerUsuarioRequest } from "./authz.js";

/**
 * Piezas de seguridad compartidas: roles por ruta, secretos que nunca salen en una respuesta,
 * cabeceras defensivas, IP real del cliente (detrás de Cloudflare) y chequeos de arranque en producción.
 */
export const esProduccion = () => process.env.NODE_ENV === "production";

/** Llamada de servidor a servidor (panel Next) con la clave interna: no tiene token de persona. */
export const esInterna = (req) => Boolean(process.env.INTERNAL_API_KEY) && req.headers["x-internal-key"] === process.env.INTERNAL_API_KEY;

/** Exige sesión y, además, uno de estos roles. Sin sesión → 401; con otro rol → 403. */
export function soloRoles(...roles) {
  const permitidos = new Set(roles);
  return [
    requireAuth,
    (req, res, next) => {
      if (esInterna(req)) return next();
      const { rol } = obtenerUsuarioRequest(req);
      if (permitidos.has(rol)) return next();
      return res.status(403).json({ mensaje: "Tu usuario no puede hacer esto" });
    },
  ];
}

const LECTURA = new Set(["GET", "HEAD", "OPTIONS"]);

/** Cualquiera con sesión puede leer; para modificar hace falta uno de estos roles. */
export function escribenSolo(...roles) {
  const [, chequeoRol] = soloRoles(...roles);
  return (req, res, next) => (LECTURA.has(req.method) ? next() : chequeoRol(req, res, next));
}

const SECRETOS = new Set(["password_hash", "auth_user_id"]);

/** Saca de cualquier respuesta (a cualquier profundidad) lo que nunca debe viajar al cliente. */
export function limpiarSecretos(valor) {
  if (Array.isArray(valor)) return valor.map(limpiarSecretos);
  if (valor && typeof valor === "object" && !(valor instanceof Date)) {
    const salida = {};
    for (const [k, v] of Object.entries(valor)) if (!SECRETOS.has(k)) salida[k] = limpiarSecretos(v);
    return salida;
  }
  return valor;
}

/** IP del cliente. Detrás de Cloudflare la real viene en CF-Connecting-IP (solo se confía si el origen está cerrado a Cloudflare). */
export function ipDe(req) {
  if (process.env.TRUST_CLOUDFLARE === "true") {
    const cf = req.headers["cf-connecting-ip"];
    if (typeof cf === "string" && cf.length < 64) return cf;
  }
  return req.ip;
}

/** Cabeceras defensivas para una API JSON (no sirve HTML, así que la política es estricta). */
export function cabecerasSeguras(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (esProduccion()) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

/** Las respuestas autenticadas no se guardan en cachés compartidas (CDN, proxies). */
export function sinCache(req, res, next) {
  if (!res.getHeader("Cache-Control")) res.setHeader("Cache-Control", "no-store");
  next();
}

const SECRETOS_DEBILES = new Set(["noctua-local-development-secret", "cambiar-en-produccion", "changeme", "secret", "password"]);

/** En producción el servidor no arranca con secretos de ejemplo: mejor caerse que quedar abierto. */
export function validarEntornoProduccion() {
  if (!esProduccion()) return;
  const problemas = [];
  const jwt = process.env.JWT_SECRET ?? "";
  if (jwt.length < 32 || SECRETOS_DEBILES.has(jwt)) problemas.push("JWT_SECRET debe tener al menos 32 caracteres y no ser el de ejemplo");
  const admin = process.env.INITIAL_ADMIN_PASSWORD ?? "";
  if (process.env.SEED_USUARIOS !== "false" && (admin.length < 10 || admin === "1234")) problemas.push("INITIAL_ADMIN_PASSWORD debe tener al menos 10 caracteres (o poné SEED_USUARIOS=false si ya hay usuarios)");
  if (problemas.length) {
    console.error(`\n[seguridad] El servidor no arranca en producción:\n - ${problemas.join("\n - ")}\n`);
    process.exit(1);
  }
}
