import { pool } from "../../config/database.js";
import { traducirConGlosario } from "./glosario.js";
import { pedirJson, proveedorLlm } from "./llm.js";

/**
 * Traduce la carta del español a inglés o portugués. Orden: caché propia → IA gratuita (si hay clave)
 * → MyMemory (traductor gratuito, sin clave) → glosario local. Solo se guarda lo que vino de un traductor
 * real; el glosario no se guarda para que mejore cuando haya conexión.
 */
export const IDIOMAS = ["en", "pt"];
const PRESUPUESTO_MS = 7000;

async function traducirMyMemory(texto, idioma) {
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", texto.slice(0, 480));
  url.searchParams.set("langpair", `es|${idioma}`);
  if (process.env.MYMEMORY_EMAIL) url.searchParams.set("de", process.env.MYMEMORY_EMAIL); // sube el cupo diario gratuito
  const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!r.ok) return null;
  const datos = await r.json();
  const t = String(datos?.responseData?.translatedText ?? "").trim();
  if (!t || datos.responseStatus !== 200 || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) return null;
  return t;
}

async function traducirConIa(textos, idioma) {
  if (!proveedorLlm() || !textos.length) return new Map();
  const nombreIdioma = idioma === "pt" ? "portugués de Brasil" : "inglés";
  const r = await pedirJson({
    sistema: `Traducís cartas de restaurantes argentinos del español al ${nombreIdioma}. Mantené los nombres propios y platos típicos reconocibles (milanesa, provoleta, empanadas, dulce de leche) y agregá una aclaración corta entre paréntesis solo si un turista no lo entendería. No agregues nada que no esté en el texto.`,
    usuario: JSON.stringify({ textos, formato: 'Devolvé {"traducciones": [...]} con el mismo orden y cantidad.' }),
    maxTokens: 1800,
  });
  const lista = r?.traducciones;
  const mapa = new Map();
  if (Array.isArray(lista) && lista.length === textos.length) textos.forEach((t, i) => { if (typeof lista[i] === "string" && lista[i].trim()) mapa.set(t, lista[i].trim().slice(0, 300)); });
  return mapa;
}

/** Devuelve Map(original → traducido) para todos los textos pedidos. */
export async function traducirTextos(textos, idioma) {
  const resultado = new Map();
  if (!IDIOMAS.includes(idioma)) { for (const t of textos) resultado.set(t, t); return resultado; }
  const unicos = [...new Set(textos.map((t) => String(t ?? "").trim()).filter(Boolean))];
  if (!unicos.length) return resultado;

  const guardadas = await pool.query("select clave, texto from traducciones where idioma = $1 and clave = any($2::text[])", [idioma, unicos]);
  for (const f of guardadas.rows) resultado.set(f.clave, f.texto);
  let faltan = unicos.filter((t) => !resultado.has(t));

  const nuevas = new Map();
  if (faltan.length) {
    const limite = Date.now() + PRESUPUESTO_MS;
    for (const [t, tr] of await traducirConIa(faltan, idioma)) nuevas.set(t, [tr, "ia"]);
    faltan = faltan.filter((t) => !nuevas.has(t));
    // MyMemory: de a 4 en paralelo y dentro del presupuesto de tiempo.
    for (let i = 0; i < faltan.length && Date.now() < limite; i += 4) {
      await Promise.all(faltan.slice(i, i + 4).map(async (t) => {
        try { const tr = await traducirMyMemory(t, idioma); if (tr) nuevas.set(t, [tr, "mymemory"]); } catch { /* sin conexión: queda el glosario */ }
      }));
    }
  }
  for (const [clave, [texto, origen]] of nuevas) {
    resultado.set(clave, texto);
    pool.query("insert into traducciones (clave, idioma, texto, origen) values ($1, $2, $3, $4) on conflict (clave, idioma) do update set texto = excluded.texto, origen = excluded.origen", [clave, idioma, texto, origen]).catch(() => {});
  }
  for (const t of unicos) if (!resultado.has(t)) resultado.set(t, traducirConGlosario(t, idioma));
  return resultado;
}
