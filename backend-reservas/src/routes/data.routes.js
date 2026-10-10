import { Router } from "express";
import { postgresClient } from "../config/postgresClient.js";
import { pool } from "../config/database.js";
import { requireAuth } from "../controllers/auth.controller.js";
import { esInterna, limpiarSecretos } from "../utils/seguridad.js";
import { obtenerUsuarioRequest } from "../utils/authz.js";

const router = Router();
const TABLES = new Set(["usuarios","mesas","categorias","productos","clientes","reservas","pedidos","pedido_items","ingredientes","producto_ingredientes","movimientos_stock","facturas","pagos","movimientos_caja","mozos","promociones","promocion_productos","tickets_soporte","cuentas_corrientes","pagos_cuenta_corriente","movimientos_cuenta_corriente","integraciones","salon_layouts"]);
const FILTERS = new Set(["eq","neq","like","ilike","gt","gte","lt","lte","is","in","or"]);
router.use(requireAuth);

/**
 * Quién puede leer y quién puede modificar cada tabla a través de este acceso genérico.
 * Sin esto, cualquier usuario con sesión (un mozo, cocina…) podía leer o cambiar cualquier tabla:
 * hashes de contraseñas, roles, facturas, credenciales de integraciones.
 * "*" = cualquier usuario con sesión. Las tablas que no aparecen acá quedan prohibidas.
 */
const TODOS = "*";
const GESTION = ["admin", "encargado"];
const CAJA = ["admin", "encargado", "cajero"];
const SALON = ["admin", "encargado", "cajero", "mozo"];
const POLITICA = {
  usuarios: { leer: GESTION, escribir: ["admin"] }, // las altas y cambios de rol van por /api/usuarios/admin
  integraciones: { leer: ["admin"], escribir: ["admin"] },
  facturas: { leer: CAJA, escribir: CAJA },
  pagos: { leer: CAJA, escribir: CAJA },
  movimientos_caja: { leer: CAJA, escribir: CAJA },
  cuentas_corrientes: { leer: CAJA, escribir: CAJA },
  pagos_cuenta_corriente: { leer: CAJA, escribir: CAJA },
  movimientos_cuenta_corriente: { leer: CAJA, escribir: CAJA },
  clientes: { leer: SALON, escribir: SALON },
  reservas: { leer: SALON, escribir: SALON },
  mesas: { leer: TODOS, escribir: [...SALON, "cocina"] },
  pedidos: { leer: TODOS, escribir: [...SALON, "cocina", "delivery"] },
  pedido_items: { leer: TODOS, escribir: [...SALON, "cocina", "delivery"] },
  productos: { leer: TODOS, escribir: [...GESTION, "stock", "cocina"] },
  categorias: { leer: TODOS, escribir: GESTION },
  ingredientes: { leer: TODOS, escribir: [...GESTION, "stock"] },
  producto_ingredientes: { leer: TODOS, escribir: [...GESTION, "stock"] },
  movimientos_stock: { leer: [...GESTION, "stock", "cajero"], escribir: [...GESTION, "stock"] },
  mozos: { leer: TODOS, escribir: GESTION },
  promociones: { leer: TODOS, escribir: GESTION },
  promocion_productos: { leer: TODOS, escribir: GESTION },
  tickets_soporte: { leer: TODOS, escribir: TODOS },
  salon_layouts: { leer: TODOS, escribir: GESTION },
};
const puede = (tabla, accion, rol) => {
  const regla = POLITICA[tabla]?.[accion];
  return regla === TODOS || (Array.isArray(regla) && regla.includes(rol));
};

router.post("/query", async (req, res) => {
  const { table, operation = "select", payload, selection = "*", filters = [], orders = [], limit, range, single } = req.body || {};
  if (!TABLES.has(table) || !POLITICA[table]) return res.status(400).json({ error: "Tabla no permitida" });
  const OPERACIONES = new Set(["select", "insert", "upsert", "update", "delete"]);
  if (!OPERACIONES.has(operation)) return res.status(400).json({ error: "Operación no permitida" });
  if (!esInterna(req)) {
    const { rol } = obtenerUsuarioRequest(req);
    if (!puede(table, operation === "select" ? "leer" : "escribir", rol)) return res.status(403).json({ error: "Tu usuario no puede hacer esto" });
    // Un cambio sin condiciones tocaría todas las filas: se exige al menos un filtro.
    if ((operation === "update" || operation === "delete") && (!Array.isArray(filters) || filters.length === 0)) return res.status(400).json({ error: "Falta indicar qué filas modificar" });
  }
  try {
    let query = postgresClient.from(table);
    if (operation === "insert" || operation === "upsert") query = operation === "upsert" ? query.upsert(payload) : query.insert(payload);
    else if (operation === "update") query = query.update(payload);
    else if (operation === "delete") query = query.delete();
    query = query.select(selection);
    for (const filter of filters) if (FILTERS.has(filter.method)) query = filter.method === "or" ? query.or(filter.value) : query[filter.method](filter.column, filter.value);
    for (const order of orders) query = query.order(order.column, { ascending: order.ascending });
    if (limit != null) query = query.limit(limit);
    if (range) query = query.range(range.from, range.to);
    if (single === "single") query = query.single();
    if (single === "maybe") query = query.maybeSingle();
    const result = await query;
    res.status(result.error ? 400 : 200).json(limpiarSecretos(result));
  } catch (error) { res.status(500).json({ data: null, error: { message: error.message } }); }
});

router.post("/rpc", async (req, res) => {
  const { name, args = {} } = req.body || {};
  if (name !== "recalcular_disponibilidad_producto") return res.status(400).json({ data: null, error: { message: "Funcion no permitida" } });
  try {
    await pool.query(`update productos p set disponible = not exists (
      select 1 from producto_ingredientes pi join ingredientes i on i.id = pi.ingrediente_id
      where pi.producto_id = p.id and i.stock_actual < pi.cantidad_necesaria
    ) where p.id = $1`, [args.p_producto_id]);
    res.json({ data: true, error: null });
  } catch (error) { res.status(500).json({ data: null, error: { message: error.message } }); }
});

export default router;
