import { Router } from "express";
import { postgresClient } from "../config/postgresClient.js";
import { pool } from "../config/database.js";
import { requireAuth } from "../controllers/auth.controller.js";

const router = Router();
const TABLES = new Set(["usuarios","mesas","categorias","productos","clientes","reservas","pedidos","pedido_items","ingredientes","producto_ingredientes","movimientos_stock","facturas","pagos","movimientos_caja","mozos","promociones","promocion_productos","tickets_soporte","cuentas_corrientes","pagos_cuenta_corriente","movimientos_cuenta_corriente","integraciones"]);
const FILTERS = new Set(["eq","neq","like","ilike","gt","gte","lt","lte","is","in","or"]);
router.use(requireAuth);

router.post("/query", async (req, res) => {
  const { table, operation = "select", payload, selection = "*", filters = [], orders = [], limit, range, single } = req.body || {};
  if (!TABLES.has(table)) return res.status(400).json({ error: "Tabla no permitida" });
  try {
    let query = postgresClient.from(table);
    if (operation === "insert") query = query.insert(payload);
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
    res.status(result.error ? 400 : 200).json(result);
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
