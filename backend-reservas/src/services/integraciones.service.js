import crypto from "node:crypto";
import { pool } from "../config/database.js";

const key = () => crypto.createHash("sha256").update(process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET || "local").digest();
function encrypt(value) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv); const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]); return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join("."); }
function decrypt(value) { const [iv, tag, data] = value.split("."); const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64")); decipher.setAuthTag(Buffer.from(tag, "base64")); return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8")); }

export async function saveIntegration(tipo, proveedor, pais, config) {
  await pool.query(`insert into integraciones(tipo,proveedor,pais,configuracion_cifrada,activa,estado,actualizado_en)
    values($1,$2,$3,$4,true,'configurada',now()) on conflict(tipo,proveedor) do update set pais=excluded.pais,
    configuracion_cifrada=excluded.configuracion_cifrada, activa=true, estado='configurada', actualizado_en=now()`, [tipo, proveedor, pais || null, encrypt(config)]);
}
export async function getIntegration(tipo, proveedor) { const result = await pool.query("select * from integraciones where tipo=$1 and proveedor=$2 and activa=true", [tipo, proveedor]); return result.rows[0] ? { ...result.rows[0], config: decrypt(result.rows[0].configuracion_cifrada) } : null; }
export async function listIntegrations(tipo) { const result = await pool.query("select id,tipo,proveedor,pais,activa,estado,ultimo_error,verificada_en,actualizado_en from integraciones where tipo=$1 and activa=true order by proveedor", [tipo]); return result.rows; }
export async function removeIntegration(tipo, proveedor) { await pool.query("update integraciones set activa=false,estado='desvinculada',actualizado_en=now() where tipo=$1 and proveedor=$2", [tipo, proveedor]); }
