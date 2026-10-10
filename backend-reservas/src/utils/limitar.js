import { ipDe } from "./seguridad.js";

/**
 * Limitador simple por IP en memoria para los endpoints públicos del QR (sin sesión).
 * No reemplaza a un proxy delante del servidor, pero frena abusos básicos.
 */
export function limitar({ ventanaMs = 60_000, max = 60, nombre = "general" } = {}) {
  const golpes = new Map();
  setInterval(() => { const ahora = Date.now(); for (const [k, v] of golpes) if (v.hasta < ahora) golpes.delete(k); }, ventanaMs).unref();
  return (req, res, next) => {
    const clave = `${nombre}:${ipDe(req)}`;
    const ahora = Date.now();
    const actual = golpes.get(clave);
    if (!actual || actual.hasta < ahora) { golpes.set(clave, { n: 1, hasta: ahora + ventanaMs }); return next(); }
    actual.n += 1;
    if (actual.n > max) {
      res.setHeader("Retry-After", Math.ceil((actual.hasta - ahora) / 1000));
      return res.status(429).json({ mensaje: "Demasiados intentos. Esperá un momento." });
    }
    return next();
  };
}
