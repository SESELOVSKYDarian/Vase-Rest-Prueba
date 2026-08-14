import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;
export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DATABASE_POOL_SIZE || 10),
  min: 0,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (error) => console.error("[postgres] Error inesperado en el pool", error));
export async function checkDatabase() {
  const result = await pool.query("select current_database() as database, now() as now");
  return result.rows[0];
}
