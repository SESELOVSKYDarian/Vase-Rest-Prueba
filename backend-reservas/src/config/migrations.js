import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./database.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = process.env.MIGRATIONS_DIR || path.resolve(here, "../../../database/init");

export async function runMigrations() {
  await pool.query(`create table if not exists _noctua_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) {
    const exists = await pool.query("select 1 from _noctua_migrations where name=$1", [name]);
    if (exists.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(await readFile(path.join(migrationsDir, name), "utf8"));
      await client.query("insert into _noctua_migrations(name) values($1)", [name]);
      await client.query("commit");
      console.log(`[postgres] Migracion aplicada: ${name}`);
    } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  }
}
