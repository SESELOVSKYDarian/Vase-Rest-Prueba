import { esRelleno, palabras, parecido, plegar, raiz } from "./texto.js";

/**
 * Índice de la carta para buscar platos por cómo los dice la gente ("milas napo", "la birra").
 * Se arma con la carta real: nunca inventa platos.
 */
export function crearIndice({ productos, categorias = [] }) {
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));
  const items = productos.map((p) => {
    const nombre = palabras(p.nombre).filter((t) => !esRelleno(t));
    return {
      producto: p,
      nombre,
      descripcion: palabras(p.descripcion ?? "").filter((t) => !esRelleno(t)),
      categoria: plegar(nombreCategoria.get(p.categoriaId ?? p.categoria_id) ?? ""),
    };
  });
  const cats = categorias.map((c) => ({ categoria: c, nombre: palabras(c.nombre).filter((t) => !esRelleno(t)) }));
  return { items, cats, categorias, productos };
}

const SINONIMOS = {
  birra: "cerveza", birras: "cerveza", cerve: "cerveza", chop: "cerveza", pinta: "cerveza",
  gaseosa: "bebida", refresco: "bebida", coca: "cola", fernet: "fernet",
  chori: "chorizo", provo: "provoleta", empa: "empanada", milas: "milanesa", mila: "milanesa", napo: "napolitana",
  postrecito: "postre", cafecito: "cafe",
};

/** Cambia apodos por la palabra de la carta ("birra" → "cerveza"). */
export function aliasar(palabra) {
  return SINONIMOS[palabra] ?? palabra;
}

/**
 * Busca platos que correspondan a una frase. Devuelve [{ producto, puntaje, completo }]
 * ordenado de mejor a peor; `completo` = todas las palabras dichas coinciden con el nombre.
 */
export function buscarProductos(indice, frase, { soloDisponibles = false, limite = 5 } = {}) {
  const dichas = palabras(frase).filter((t) => !esRelleno(t) && !/^\d+$/.test(t)).map(aliasar);
  if (!dichas.length) return [];
  const resultados = [];
  for (const item of indice.items) {
    if (soloDisponibles && item.producto.disponible === false) continue;
    let suma = 0;
    let coinciden = 0;
    for (const dicha of dichas) {
      let mejor = 0;
      for (const palabra of item.nombre) mejor = Math.max(mejor, parecido(dicha, aliasar(palabra)));
      // La categoría ayuda un poco ("una cerveza" → plato de la categoría Bebidas), sin decidir sola.
      if (mejor < 0.55 && item.categoria && item.categoria.split(" ").some((c) => parecido(dicha, c) >= 0.8)) mejor = 0.4;
      if (mejor >= 0.55) coinciden += 1;
      suma += mejor;
    }
    const puntaje = suma / dichas.length;
    const completo = coinciden === dichas.length;
    if (!completo && !(puntaje >= 0.6 && coinciden >= Math.ceil(dichas.length * 0.6))) continue;
    // Entre empatados gana el nombre más corto ("milanesa" antes que "milanesa napolitana con fritas").
    resultados.push({ producto: item.producto, puntaje: puntaje - item.nombre.length * 0.01, completo });
  }
  resultados.sort((a, b) => b.puntaje - a.puntaje);
  return resultados.slice(0, limite);
}

/** Categoría nombrada en la frase ("las bebidas", "los postres") o null. */
export function buscarCategoria(indice, frase) {
  const dichas = palabras(frase).filter((t) => !esRelleno(t)).map(aliasar);
  let mejor = null;
  for (const { categoria, nombre } of indice.cats) {
    if (!nombre.length) continue;
    const todas = nombre.every((n) => dichas.some((d) => parecido(d, n) >= 0.85));
    if (todas && (!mejor || nombre.length > mejor.largo)) mejor = { categoria, largo: nombre.length };
  }
  return mejor?.categoria ?? null;
}

/** ¿La frase dice alguna de estas palabras (ya plegadas, sin tildes)? */
export function dice(frase, ...claves) {
  const p = plegar(frase);
  return claves.some((c) => new RegExp(`(^|[^a-z])${c}([^a-z]|$)`).test(p));
}

export { raiz };
