import { postgresClient } from "../config/postgresClient.js";
import { pool } from "../config/database.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

function asString(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "activo" : "inactivo";

  return fallback;
}

function normalizarEstado(usuario) {
  if (usuario.estado !== undefined && usuario.estado !== null) {
    return asString(usuario.estado);
  }

  if (usuario.status !== undefined && usuario.status !== null) {
    return asString(usuario.status);
  }

  if (usuario.activo !== undefined && usuario.activo !== null) {
    return usuario.activo ? "activo" : "inactivo";
  }

  if (usuario.disponible !== undefined && usuario.disponible !== null) {
    return usuario.disponible ? "activo" : "inactivo";
  }

  return null;
}

function normalizarUsuario(usuario) {
  const nombre =
    usuario.nombre ||
    usuario.full_name ||
    usuario.name ||
    usuario.username ||
    usuario.email ||
    "Sin nombre";

  return {
    id: asString(usuario.id || usuario.user_id || usuario.auth_id),
    nombre: asString(nombre, "Sin nombre"),
    email: asString(usuario.email || usuario.correo || usuario.mail),
    rol: asString(usuario.rol || usuario.role || usuario.tipo, "sin rol"),
    estado: normalizarEstado(usuario),
    creadoEn:
      usuario.creado_en ||
      usuario.created_at ||
      usuario.createdAt ||
      usuario.fecha_creacion ||
      null,
  };
}

async function obtenerDesdeTabla(tabla) {
  const { data, error } = await postgresClient.from(tabla).select("*");

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export const obtenerUsuarios = async (req, res) => {
  try {
    let tablaUsada = "usuarios";
    let usuariosRaw = [];

    try {
      usuariosRaw = await obtenerDesdeTabla("usuarios");
    } catch (usuariosError) {
      tablaUsada = "profiles";

      try {
        usuariosRaw = await obtenerDesdeTabla("profiles");
      } catch (profilesError) {
        return res.status(500).json({
          mensaje: "Error al obtener usuarios desde PostgreSQL",
          error: profilesError.message,
          detalleUsuarios: usuariosError.message,
        });
      }
    }

    const usuarios = usuariosRaw
      .map(normalizarUsuario)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return res.json({
      mensaje: "Usuarios obtenidos correctamente",
      total: usuarios.length,
      tabla: tablaUsada,
      usuarios,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al obtener usuarios",
      error: error.message,
    });
  }
};

export const administrarUsuario = async (req, res) => {
  try {
    const { accion } = req.body || {};
    if (accion === "crear") {
      const { email, password, nombre, username, rol = "mozo", activo = true } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email y contrasena son requeridos" });
      const hash = await bcrypt.hash(password, 12);
      const id = crypto.randomUUID();
      const result = await pool.query(`insert into usuarios(id,auth_user_id,nombre,username,email,rol,activo,password_hash)
        values($1,$1,$2,$3,$4,$5,$6,$7) returning id,email,nombre,username,rol,activo`, [id, nombre || username || email, (username || email.split("@")[0]).toLowerCase(), email.toLowerCase(), rol, activo, hash]);
      return res.status(201).json({ id: result.rows[0].id, email: result.rows[0].email, usuario: result.rows[0] });
    }
    if (accion === "crearPerfil") {
      const { auth_user_id, nombre, username, rol, activo = true } = req.body;
      const result = await pool.query(`update usuarios set nombre=$2,username=$3,rol=$4,activo=$5,actualizado_en=now()
        where auth_user_id=$1 returning id,auth_user_id,nombre,username,email,rol,activo,creado_en`, [auth_user_id, nombre, username.toLowerCase(), rol, activo]);
      return res.json({ usuario: result.rows[0] });
    }
    if (accion === "actualizar") {
      const id = req.body.authUserId || req.body.id; const fields = []; const values = [];
      for (const [column, value] of [["email", req.body.email], ["nombre", req.body.nombre], ["username", req.body.username], ["rol", req.body.rol], ["activo", req.body.activo]]) if (value !== undefined) { values.push(value); fields.push(`${column}=$${values.length}`); }
      if (req.body.password) { values.push(await bcrypt.hash(req.body.password, 12)); fields.push(`password_hash=$${values.length}`); }
      values.push(id); await pool.query(`update usuarios set ${fields.join(",")}, actualizado_en=now() where id=$${values.length} or auth_user_id=$${values.length}`, values);
      return res.json({ ok: true });
    }
    if (accion === "eliminar") { const id = req.body.authUserId || req.body.id; await pool.query("delete from usuarios where id=$1 or auth_user_id=$1", [id]); return res.json({ ok: true }); }
    return res.status(400).json({ error: "Accion no reconocida" });
  } catch (error) { return res.status(error.code === "23505" ? 409 : 500).json({ error: error.message, code: error.code }); }
};
