import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";

// En producción el servidor no arranca sin JWT_SECRET propio (ver validarEntornoProduccion); el de ejemplo es solo para desarrollo.
const secret = () => process.env.JWT_SECRET || "noctua-local-development-secret";

const enProduccion = () => process.env.NODE_ENV === "production";

export async function seedLocalAdmin() {
  if (process.env.SEED_USUARIOS === "false") return;
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || "1234";
  const hash = await bcrypt.hash(initialPassword, 12);
  // La contraseña de admin solo se (re)escribe si no tiene o si se pide explícitamente (RESET_ADMIN_PASSWORD=true):
  // antes se pisaba en cada arranque, y una contraseña cambiada volvía a la de ejemplo.
  await pool.query(`insert into usuarios (nombre, username, email, rol, activo, password_hash)
    values ('Administrador','admin','admin@noctua.local','admin',true,$1)
    on conflict (username) do update set
      nombre = excluded.nombre,
      email = excluded.email,
      rol = excluded.rol,
      activo = true,
      password_hash = case when usuarios.password_hash is null or $2::boolean then excluded.password_hash else usuarios.password_hash end,
      actualizado_en = now()`, [hash, process.env.RESET_ADMIN_PASSWORD === "true"]);

  // Los usuarios de ejemplo (mozo/mozo123…) son para desarrollo: en producción no se crean salvo pedido explícito.
  if (enProduccion() && process.env.SEED_USUARIOS_DEMO !== "true") return;

  const roleUsers = [
    ["encargado", "encargado", "Encargado", "encargado123"],
    ["mozo", "mozo", "Mozo", "mozo123"],
    ["cocina", "cocina", "Cocina", "cocina123"],
    ["cajero", "cajero", "Cajero", "cajero123"],
    ["soporte", "soporte", "Soporte", "soporte123"],
    ["stock", "stock", "Stock", "stock123"],
    ["delivery", "delivery", "Delivery", "delivery123"],
    ["desarrollador", "desarrollador", "Desarrollador", "desarrollador123"],
  ];

  for (const [role, username, name, fallbackPassword] of roleUsers) {
    const envName = `INITIAL_${String(role).toUpperCase()}_PASSWORD`;
    const password = process.env[envName] || fallbackPassword;
    const roleHash = await bcrypt.hash(password, 12);
    await pool.query(`insert into usuarios (nombre, username, email, rol, activo, password_hash)
      values ($1, $2, $3, $4, true, $5)
      on conflict (username) do update set
        password_hash = coalesce(usuarios.password_hash, excluded.password_hash),
        activo = true,
        rol = excluded.rol,
        actualizado_en = now()`,
      [name, username, `${username}@noctua.local`, role, roleHash]);
  }
}

// Contra la fuerza bruta: tras varios errores seguidos de un mismo usuario se frena un rato (además del límite por IP en la ruta).
const fallos = new Map();
const MAX_FALLOS = 8;
const BLOQUEO_MS = 10 * 60_000;
setInterval(() => { const ahora = Date.now(); for (const [k, v] of fallos) if (v.hasta < ahora) fallos.delete(k); }, 60_000).unref();
// Hash de mentira: así el tiempo de respuesta no delata si el usuario existe.
const HASH_FALSO = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8.4L5O9nKQe3x1o3q8k9m7yq0H3yzK";

export async function login(req, res) {
  const { usuario, email, password } = req.body || {};
  const loginValue = String(usuario || email || "").trim().toLowerCase().slice(0, 120);
  const clave = String(password ?? "").slice(0, 200);
  const marca = fallos.get(loginValue);
  if (marca && marca.n >= MAX_FALLOS && marca.hasta > Date.now()) {
    res.setHeader("Retry-After", Math.ceil((marca.hasta - Date.now()) / 1000));
    return res.status(429).json({ error: "Demasiados intentos. Esperá unos minutos." });
  }
  const result = await pool.query("select id,nombre,username,email,rol,activo,password_hash from usuarios where lower(username)=$1 or lower(email)=$1 limit 1", [loginValue]);
  const user = result.rows[0];
  const correcto = await bcrypt.compare(clave, user?.password_hash || HASH_FALSO);
  if (!user || !user.activo || !user.password_hash || !correcto) {
    const actual = fallos.get(loginValue);
    fallos.set(loginValue, { n: (actual && actual.hasta > Date.now() ? actual.n : 0) + 1, hasta: Date.now() + BLOQUEO_MS });
    return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
  }
  fallos.delete(loginValue);
  const token = jwt.sign({ sub: user.id, rol: user.rol, nombre: user.nombre }, secret(), { expiresIn: "12h", algorithm: "HS256" });
  res.json({ token, usuario: { id: user.id, nombre: user.nombre, username: user.username, email: user.email, rol: user.rol } });
}

/**
 * Identidad "blanda": si llega un Bearer válido se deja en req.auth (rol/nombre/id firmados);
 * si no, la request sigue sin identidad. Va montado globalmente para que los controladores
 * (pedidos, facturas) lean la identidad del token y no de headers que escribe el cliente.
 * Exigir sesión en cada ruta (requireAuth) se activa cuando el panel Next envíe el token.
 */
export function attachAuth(req, _res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (token) {
    try { req.auth = jwt.verify(token, secret(), { algorithms: ["HS256"] }); } catch { /* token inválido: sin identidad */ }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (process.env.INTERNAL_API_KEY && req.headers["x-internal-key"] === process.env.INTERNAL_API_KEY) return next();
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  try { req.auth = jwt.verify(token, secret(), { algorithms: ["HS256"] }); next(); } catch { res.status(401).json({ error: "Sesion invalida o vencida" }); }
}
