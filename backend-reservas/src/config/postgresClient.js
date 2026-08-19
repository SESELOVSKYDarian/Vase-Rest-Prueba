import { pool } from "./database.js";

const ident = (value) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error(`Identificador SQL invalido: ${value}`);
  return `"${value}"`;
};

const RELATIONS = {
  pedidos: { mesas: ["mesa_id", "mesas", "id", false], pedido_items: ["id", "pedido_items", "pedido_id", true] },
  pedido_items: { productos: ["producto_id", "productos", "id", false] },
  productos: { categorias: ["categoria_id", "categorias", "id", false], producto_ingredientes: ["id", "producto_ingredientes", "producto_id", true] },
  producto_ingredientes: { ingredientes: ["ingrediente_id", "ingredientes", "id", false] },
  reservas: { mesas: ["mesa_id", "mesas", "id", false] },
  facturas: { clientes: ["cliente_id", "clientes", "id", false], pagos: ["pago_id", "pagos", "id", false], pedidos: ["pedido_id", "pedidos", "id", false] },
  cuentas_corrientes: { clientes: ["cliente_id", "clientes", "id", false] },
};

function relationNames(selection) {
  return [...String(selection).matchAll(/(?:^|,)\s*([a-z_][a-z0-9_]*)\s*\(/gi)].map((match) => match[1]);
}

async function hydrate(table, rows, selection) {
  for (const name of relationNames(selection)) {
    const relation = RELATIONS[table]?.[name];
    if (!relation) continue;
    const [sourceKey, targetTable, targetKey, many] = relation;
    const ids = [...new Set(rows.map((row) => row[sourceKey]).filter(Boolean))];
    if (!ids.length) { rows.forEach((row) => { row[name] = many ? [] : null; }); continue; }
    const result = await pool.query(`select * from ${ident(targetTable)} where ${ident(targetKey)} = any($1)`, [ids]);
    await hydrate(targetTable, result.rows, selection);
    rows.forEach((row) => { const matches = result.rows.filter((item) => item[targetKey] === row[sourceKey]); row[name] = many ? matches : matches[0] ?? null; });
  }
  return rows;
}

class PostgresQuery {
  constructor(table) { this.table = table; this.operation = "select"; this.payload = null; this.filters = []; this.orders = []; this.selection = "*"; this.max = null; this.offset = null; this.one = false; this.optional = false; }
  select(columns = "*") { this.selection = columns; return this; }
  insert(value) { this.operation = "insert"; this.payload = value; return this; }
  upsert(value) { this.operation = "upsert"; this.payload = value; return this; }
  update(value) { this.operation = "update"; this.payload = value; return this; }
  delete() { this.operation = "delete"; return this; }
  eq(column, value) { return this.add(column, "=", value); }
  neq(column, value) { return this.add(column, "<>", value); }
  like(column, value) { return this.add(column, "like", value); }
  ilike(column, value) { return this.add(column, "ilike", value); }
  gt(column, value) { return this.add(column, ">", value); }
  gte(column, value) { return this.add(column, ">=", value); }
  lt(column, value) { return this.add(column, "<", value); }
  lte(column, value) { return this.add(column, "<=", value); }
  is(column, value) { return this.add(column, "is", value); }
  in(column, value) { return this.add(column, "in", value); }
  or(value) { this.filters.push({ op: "or", value }); return this; }
  add(column, op, value) { this.filters.push({ column, op, value }); return this; }
  order(column, options = {}) { this.orders.push([column, options.ascending !== false]); return this; }
  limit(value) { this.max = Number(value); return this; }
  range(from, to) { this.offset = Number(from); this.max = Number(to) - Number(from) + 1; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; this.optional = true; return this; }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  buildWhere(start = 1) {
    const values = [];
    const clauses = this.filters.map((filter) => {
      if (filter.op === "in") { values.push(filter.value); return `${ident(filter.column)} = any($${start + values.length - 1})`; }
      if (filter.op === "is") return `${ident(filter.column)} is ${filter.value === null ? "null" : "not null"}`;
      if (filter.op === "or") {
        const parts = String(filter.value).split(",").map((part) => { const [column, operator, ...raw] = part.split("."); values.push(raw.join(".").replaceAll("*", "%")); return `${ident(column)} ${operator === "ilike" ? "ilike" : "="} $${start + values.length - 1}`; });
        return `(${parts.join(" or ")})`;
      }
      values.push(filter.value); return `${ident(filter.column)} ${filter.op} $${start + values.length - 1}`;
    });
    return { sql: clauses.length ? ` where ${clauses.join(" and ")}` : "", values };
  }
  async execute() {
    try {
      let sql; let values = [];
      if (this.operation === "insert" || this.operation === "upsert") {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const columns = Object.keys(rows[0] || {});
        const groups = rows.map((row) => `(${columns.map((column) => { values.push(row[column]); return `$${values.length}`; }).join(",")})`);
        sql = `insert into ${ident(this.table)} (${columns.map(ident).join(",")}) values ${groups.join(",")}${this.operation === "upsert" ? ` on conflict ("id") do update set ${columns.filter((column) => column !== "id").map((column) => `${ident(column)}=excluded.${ident(column)}`).join(",")}` : ""} returning *`;
      } else if (this.operation === "update") {
        const entries = Object.entries(this.payload); values = entries.map(([, value]) => value);
        const where = this.buildWhere(values.length + 1); values.push(...where.values);
        sql = `update ${ident(this.table)} set ${entries.map(([column], index) => `${ident(column)}=$${index + 1}`).join(",")}${where.sql} returning *`;
      } else {
        const where = this.buildWhere(); values = where.values;
        sql = `${this.operation === "delete" ? "delete from" : "select * from"} ${ident(this.table)}${where.sql}${this.operation === "delete" ? " returning *" : ""}`;
      }
      if (this.operation === "select" && this.orders.length) sql += ` order by ${this.orders.map(([column, ascending]) => `${ident(column)} ${ascending ? "asc" : "desc"}`).join(",")}`;
      if (this.operation === "select" && this.max != null) sql += ` limit ${Math.max(0, this.max)}`;
      if (this.operation === "select" && this.offset != null) sql += ` offset ${Math.max(0, this.offset)}`;
      const result = await pool.query(sql, values);
      const rows = await hydrate(this.table, result.rows, this.selection);
      if (this.one && !this.optional && rows.length !== 1) return { data: null, error: { message: `Se esperaba una fila y se obtuvieron ${rows.length}`, code: "PGRST116" } };
      return { data: this.one ? rows[0] ?? null : rows, error: null, count: result.rowCount };
    } catch (error) { return { data: null, error: { message: error.message, code: error.code, details: error.detail, hint: error.hint } }; }
  }
}

export const postgresClient = { from: (table) => new PostgresQuery(table) };
