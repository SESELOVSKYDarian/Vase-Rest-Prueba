import pg from 'pg';

const { Pool } = pg;
const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;
if (!sourceUrl || !targetUrl) throw new Error('Defini SOURCE_DATABASE_URL y DATABASE_URL');
const source = new Pool({ connectionString: sourceUrl, ssl: sourceUrl.includes('localhost') ? false : { rejectUnauthorized: false } });
const target = new Pool({ connectionString: targetUrl, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
const tables = ['usuarios','mesas','categorias','productos','clientes','reservas','pedidos','pedido_items','ingredientes','producto_ingredientes','movimientos_stock','pagos','facturas','movimientos_caja','mozos','promociones','promocion_productos','tickets_soporte','cuentas_corrientes','pagos_cuenta_corriente','movimientos_cuenta_corriente'];
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;

for (const table of tables) {
  const exists = await source.query('select to_regclass($1) as name', [`public.${table}`]);
  if (!exists.rows[0]?.name) continue;
  const result = await source.query(`select * from ${quote(table)}`);
  if (!result.rows.length) { console.log(`${table}: sin datos`); continue; }
  const targetColumnsResult = await target.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1", [table]);
  const allowed = new Set(targetColumnsResult.rows.map((row) => row.column_name));
  const columns = Object.keys(result.rows[0]).filter((column) => allowed.has(column));
  for (const row of result.rows) {
    const values = columns.map((column) => row[column]);
    await target.query(`insert into ${quote(table)} (${columns.map(quote).join(',')}) values (${values.map((_, index) => `$${index + 1}`).join(',')}) on conflict do nothing`, values);
  }
  console.log(`${table}: ${result.rows.length} filas migradas`);
}

await source.end(); await target.end();
console.log('Migracion de datos terminada. Las contrasenas deben restablecerse en PostgreSQL.');
