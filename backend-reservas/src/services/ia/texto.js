/**
 * Utilidades de texto en español rioplatense para entender pedidos y comandos dictados.
 * Todo es puro (sin red ni base): sirve igual con y sin IA externa.
 */

const TILDES = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n", Á: "a", É: "e", Í: "i", Ó: "o", Ú: "u", Ü: "u", Ñ: "n" };

/** Minúsculas y sin tildes, letra por letra: el resultado mide lo mismo que el original (sirve para recortar el original). */
export function plegar(texto) {
  let salida = "";
  for (const letra of String(texto ?? "")) salida += TILDES[letra] ?? letra.toLowerCase();
  return salida;
}

/** Palabras sueltas, sin signos, plegadas. */
export function palabras(texto) {
  return plegar(texto).replace(/[^a-z0-9%$.,]+/g, " ").replace(/[.,]+(?=\s|$)/g, "").split(/\s+/).filter(Boolean);
}

const RELLENO = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a", "con", "sin", "por", "para", "en", "y", "e", "o",
  "lo", "le", "me", "mi", "que", "quiero", "queria", "queremos", "dame", "damela", "traeme", "trae", "poneme", "pone", "agregame", "agrega", "agregar", "anota", "anotame",
  "porfa", "favor", "por", "favor", "gracias", "mas", "tambien", "ademas", "unidad", "unidades", "porcion", "porciones", "plato", "platos", "orden", "ordenes",
]);
export const esRelleno = (p) => RELLENO.has(p);

/** Singular tosco: "milas" → "mila", "ravioles" → "raviole". Se aplica igual a ambos lados al comparar. */
export function raiz(palabra) {
  let p = palabra;
  if (p.length > 4 && p.endsWith("es")) p = p.slice(0, -2);
  else if (p.length > 3 && p.endsWith("s")) p = p.slice(0, -1);
  return p;
}

/** Distancia de edición, cortada en `max` (rápida para palabras cortas). */
export function distancia(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    let minimo = fila[0];
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
      if (fila[j] < minimo) minimo = fila[j];
    }
    if (minimo > max) return max + 1;
  }
  return fila[b.length];
}

/** Cuánto se parece una palabra dicha a una palabra del nombre de un plato (0 a 1). */
export function parecido(dicha, nombre) {
  const a = raiz(dicha);
  const b = raiz(nombre);
  if (a === b) return 1;
  if (a.length >= 3 && b.startsWith(a)) return 0.85; // "napo" → "napolitana"
  if (b.length >= 3 && a.startsWith(b) && a.length - b.length <= 2) return 0.8;
  if (a.length >= 5 && b.length >= 5 && distancia(a, b, 1) <= 1) return 0.7; // "ravioli" → "ravioles"
  if (a.length >= 7 && b.length >= 7 && distancia(a, b, 2) <= 2) return 0.55;
  return 0;
}

const NUMEROS = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20, par: 2, pareja: 2, docena: 12,
};

/** "dos", "2", "x2", "2x" → 2; si no es un número devuelve null. */
export function leerNumero(palabra) {
  if (palabra in NUMEROS) return NUMEROS[palabra];
  const m = /^x?(\d{1,3})x?$/.exec(palabra);
  return m ? Number(m[1]) : null;
}

/**
 * Lee un importe dicho o escrito: "22000", "22.000", "22 mil", "veintidós mil", "$ 8.500,50".
 * Devuelve pesos (número) o null.
 */
export function leerImporte(texto) {
  const t = plegar(texto).replace(/\$/g, " ").trim();
  const mil = /(\d+(?:[.,]\d+)?)\s*mil\b/.exec(t);
  if (mil) return Math.round(Number(mil[1].replace(",", ".")) * 1000);
  const m = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?|\d+\.\d{1,2})/.exec(t);
  if (!m) return null;
  let crudo = m[1];
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(crudo)) crudo = crudo.replace(/\./g, "").replace(",", ".");
  else crudo = crudo.replace(",", ".");
  const valor = Number(crudo);
  return Number.isFinite(valor) ? valor : null;
}

/** Redondea un precio al múltiplo de $10 más cercano (los precios de carta no llevan centavos sueltos). */
export const redondearPrecio = (pesos) => Math.round(pesos / 10) * 10;
