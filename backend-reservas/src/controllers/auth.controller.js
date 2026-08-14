import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";

const secret = () => process.env.JWT_SECRET || "noctua-local-development-secret";

export async function seedLocalAdmin() {
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || "1234";
  const hash = await bcrypt.hash(initialPassword, 12);
  await pool.query(`insert into usuarios (nombre, username, email, rol, activo, password_hash)
    values ('Administrador','admin','admin@noctua.local','admin',true,$1)
    on conflict (username) do update set
      nombre = excluded.nombre,
      email = excluded.email,
      rol = excluded.rol,
      activo = true,
      password_hash = excluded.password_hash,
      actualizado_en = now()`, [hash]);

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

export async function login(req, res) {
  const { usuario, email, password } = req.body || {};
  const loginValue = String(usuario || email || "").trim().toLowerCase();
  const result = await pool.query("select id,nombre,username,email,rol,activo,password_hash from usuarios where lower(username)=$1 or lower(email)=$1 limit 1", [loginValue]);
  const user = result.rows[0];
  if (!user || !user.activo || !user.password_hash || !(await bcrypt.compare(String(password || ""), user.password_hash))) return res.status(401).json({ error: "Usuario o contrasena incorrectos" });
  const token = jwt.sign({ sub: user.id, rol: user.rol, nombre: user.nombre }, secret(), { expiresIn: "12h" });
  res.json({ token, usuario: { id: user.id, nombre: user.nombre, username: user.username, email: user.email, rol: user.rol } });
}

export function requireAuth(req, res, next) {
  if (process.env.INTERNAL_API_KEY && req.headers["x-internal-key"] === process.env.INTERNAL_API_KEY) return next();
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  try { req.auth = jwt.verify(token, secret()); next(); } catch { res.status(401).json({ error: "Sesion invalida o vencida" }); }
}
