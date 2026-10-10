import { buscarCategoria, buscarProductos, dice } from "./indice.js";
import { esRelleno, leerImporte, leerNumero, palabras, parecido, plegar, redondearPrecio } from "./texto.js";

/**
 * Comprensión de texto sin IA externa (reglas + coincidencia aproximada con la carta real).
 * Funciona sin conexión y sin claves; la IA gratuita, si está configurada, solo mejora los casos difíciles.
 */

const MODIFICADORES = new Set(["sin", "con", "extra", "jugoso", "jugosa", "cocido", "cocida", "bien", "poco", "punto", "llevar", "frio", "fria", "caliente", "hielo"]);

/** Parte un dictado en pedacitos por comas, "y", "más"... sin romper "sin jamón y sin queso". */
function segmentar(original) {
  const plano = plegar(original);
  const cortes = [];
  const re = /[,;]|\s+(?:y|e|mas|ademas|tambien)\s+/g;
  let m;
  while ((m = re.exec(plano))) cortes.push([m.index, m.index + m[0].length, /^\s*(y|e)\s*$/.test(m[0]) ? "y" : ","]);
  const trozos = [];
  let desde = 0;
  let separador = "";
  for (const [a, b, sep] of cortes) { trozos.push({ texto: original.slice(desde, a).trim(), separador }); desde = b; separador = sep; }
  trozos.push({ texto: original.slice(desde).trim(), separador });
  // "sin queso" / "con papas" suelto es parte del plato anterior, no un plato nuevo.
  const unidos = [];
  for (const { texto, separador: sep } of trozos) {
    if (!texto) continue;
    const primera = plegar(texto).split(/\s+/)[0];
    if ((primera === "sin" || primera === "con") && unidos.length) unidos[unidos.length - 1] += sep === "y" ? ` y ${texto}` : `, ${texto}`;
    else unidos.push(texto);
  }
  return unidos;
}

/** Separa cantidad, frase del plato y aclaraciones ("sin jamón", "bien cocida"). */
function leerSegmento(segmento) {
  const orig = segmento.split(/\s+/).filter(Boolean);
  const fold = orig.map((w) => plegar(w).replace(/[^a-z0-9]/g, ""));
  let cantidad = null;
  const usado = new Set();
  for (let i = 0; i < fold.length && cantidad === null; i++) {
    if (fold[i] === "media" && fold[i + 1] === "docena") { cantidad = 6; usado.add(i); usado.add(i + 1); break; }
    const n = leerNumero(fold[i]);
    if (n !== null && !(fold[i] === "un" && i > 0 && fold[i - 1] === "con")) { cantidad = n; usado.add(i); }
  }
  // Dónde empiezan las aclaraciones: primera palabra "sin/con/bien/poco/para llevar...".
  let inicioNotas = fold.length;
  for (let i = 0; i < fold.length; i++) {
    if (usado.has(i)) continue;
    const f = fold[i];
    const esMod = f === "sin" || f === "con" || f === "extra" || f === "jugoso" || f === "jugosa"
      || (f === "bien" && /^(cocid|frio|fria|calient|hech)/.test(fold[i + 1] ?? ""))
      || (f === "poco" && /^(hech|cocid)/.test(fold[i + 1] ?? ""))
      || (f === "a" && fold[i + 1] === "punto") || (f === "al" && fold[i + 1] === "punto")
      || (f === "para" && fold[i + 1] === "llevar");
    if (esMod) { inicioNotas = i; break; }
  }
  const frase = orig.filter((_, i) => i < inicioNotas && !usado.has(i)).join(" ");
  const notas = orig.slice(inicioNotas).filter((_, i) => !usado.has(inicioNotas + i)).join(" ").replace(/[.,;]+$/, "");
  return { cantidad, frase, notas };
}

/**
 * Convierte un pedido dictado en líneas de la carta.
 * "dos milas napo, una sin jamón y una malbec" → 1× milanesa napolitana, 1× milanesa napolitana sin jamón, 1× Malbec.
 */
export function interpretarPedido(texto, indice) {
  const lineas = [];
  const noEntendido = [];
  for (const segmento of segmentar(String(texto ?? ""))) {
    const { cantidad, frase, notas } = leerSegmento(segmento);
    const palabrasFrase = palabras(frase).filter((t) => !esRelleno(t));
    if (!palabrasFrase.length) {
      // "una sin jamón": es una variante del plato anterior.
      const anterior = lineas[lineas.length - 1];
      if (notas && anterior) {
        const q = Math.min(cantidad ?? 1, anterior.cantidad);
        anterior.cantidad -= q;
        const variante = { ...anterior, cantidad: q, notas: [anterior.notas, notas].filter(Boolean).join(", ") };
        if (anterior.cantidad === 0) lineas.splice(lineas.length - 1, 1);
        lineas.push(variante);
      } else if (segmento.trim()) {
        noEntendido.push(segmento.trim());
      }
      continue;
    }
    const candidatos = buscarProductos(indice, frase, { limite: 4 });
    if (!candidatos.length) { noEntendido.push(segmento.trim()); continue; }
    const [mejor, segundo] = candidatos;
    const ambiguo = !!segundo && segundo.completo && mejor.completo && mejor.puntaje - segundo.puntaje < 0.03;
    lineas.push({
      productoId: mejor.producto.id,
      nombre: mejor.producto.nombre,
      cantidad: cantidad ?? 1,
      notas: notas || "",
      agotado: mejor.producto.disponible === false,
      ambiguo,
      alternativas: ambiguo ? candidatos.slice(1).filter((c) => c.completo).map((c) => ({ id: c.producto.id, nombre: c.producto.nombre })) : [],
    });
  }
  return { lineas, noEntendido };
}

const VERBOS_SUBIR = /\b(sub[ie]\w*|aument\w*|sum[ae]\w*|encarec\w*|increment\w*)/;
const VERBOS_BAJAR = /\b(baj[ae]\w*|reduc\w*|descont\w*|rebaj\w*|abarat\w*|restal\w*)/;
const PALABRAS_ORDEN = /\b(marca\w*|pone\w*|dej\w*|pas[ae]\w*|cambi\w*|actualiz\w*|modific\w*|hace\w*|sub[ie]\w*|aument\w*|baj[ae]\w*|reduc\w*|descont\w*|rebaj\w*|sum[ae]\w*|el|la|los|las|un|una|de|del|a|en|por|ciento|precio|precios|todo|toda|todos|todas|carta|menu|plato|platos|sale|cuesta|esta|estan|ya|hay|no|mas|se|nos|acabo|acabaron|termino|terminaron|quedo|quedamos|sin|stock|agotad\w*|disponible|disponibles|volvio|volvieron|repuse|repusimos|otra|vez|nuevo|de)\b/g;

/** Frase con el objetivo ("las bebidas", "el bife") sacando verbos y números. */
function objetivoDe(plano) {
  return plano
    .replace(/\d+(?:[.,]\d+)?\s*(?:%|por\s*ciento|porciento)/g, " ")
    .replace(/\$?\s*\d[\d.,]*\s*(?:mil\b)?/g, " ")
    .replace(PALABRAS_ORDEN, " ")
    .replace(/[%$.,;:!?¡¿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolverObjetivo(indice, frase, plano) {
  if (/\b(toda la carta|todo el menu|todos los precios|todos los platos|todo)\b/.test(plano) && !frase) return { alcance: "todo", productos: indice.productos };
  const categoria = buscarCategoria(indice, frase);
  if (categoria) return { alcance: "categoria", categoria, productos: indice.productos.filter((p) => (p.categoriaId ?? p.categoria_id) === categoria.id) };
  // Varios platos nombrados: "el flan y el brownie".
  const partes = frase.split(/\s+(?:y|e)\s+|,/).map((p) => p.trim()).filter(Boolean);
  const encontrados = [];
  for (const parte of partes) {
    const [mejor] = buscarProductos(indice, parte, { limite: 1 });
    if (mejor?.completo && !encontrados.some((p) => p.id === mejor.producto.id)) encontrados.push(mejor.producto);
  }
  if (encontrados.length) return { alcance: "productos", productos: encontrados };
  return null;
}

const resumenProducto = (p, nuevo) => ({ id: p.id, nombre: p.nombre, precioActual: Number(p.precio), ...(nuevo !== undefined ? { precioNuevo: nuevo } : {}), disponible: p.disponible !== false });

/**
 * Entiende una orden del personal ("marcá agotado el bife", "subí 8% las bebidas").
 * Devuelve acciones propuestas con el antes y el después: nada se aplica hasta que la persona confirma.
 */
function interpretarUno(texto, indice) {
  const plano = plegar(texto).replace(/\s+/g, " ").trim();
  const acciones = [];
  let respuesta = null;
  const noEntendido = [];

  const pct = /(\d+(?:[.,]\d+)?)\s*(?:%|por\s*ciento|porciento)/.exec(plano) ?? /\b(?:sub[ie]\w*|aument\w*|baj[ae]\w*|reduc\w*|descont\w*|rebaj\w*)\s+(?:un\s+|el\s+)?(\d+(?:[.,]\d+)?)\b/.exec(plano);
  const sube = VERBOS_SUBIR.test(plano);
  const baja = VERBOS_BAJAR.test(plano) || /\bdescuento\b/.test(plano);

  if (/\b(que|cuales|cuantos|lista|mostra|decime)\b.*\b(agotad\w*|sin stock)\b/.test(plano)) {
    const agotados = indice.productos.filter((p) => p.disponible === false);
    respuesta = agotados.length ? { tipo: "agotados", productos: agotados.map((p) => resumenProducto(p)) } : { tipo: "agotados", productos: [] };
  } else if (pct && (sube || baja)) {
    const valor = Number(pct[1].replace(",", "."));
    const objetivo = resolverObjetivo(indice, objetivoDe(plano), plano);
    if (!objetivo || !objetivo.productos.length) noEntendido.push("No encontré qué platos tengo que cambiar.");
    else if (valor <= 0 || valor > 100) noEntendido.push("El porcentaje tiene que estar entre 1 y 100.");
    else {
      const signo = baja && !sube ? -1 : 1;
      acciones.push({
        tipo: "precio_pct",
        pct: signo * valor,
        alcance: objetivo.alcance,
        categoriaId: objetivo.categoria?.id ?? null,
        productos: objetivo.productos.map((p) => resumenProducto(p, redondearPrecio(Number(p.precio) * (1 + (signo * valor) / 100)))),
        resumen: `${signo > 0 ? "Subir" : "Bajar"} ${valor} %`,
      });
    }
  } else if (/\b(agotad\w*|sin stock|se acabo|se acabaron|se termino|se terminaron|no hay mas|no queda\w*|quedamos sin|nos quedamos sin)\b/.test(plano)) {
    const objetivo = resolverObjetivo(indice, objetivoDe(plano), plano);
    if (!objetivo) noEntendido.push("No encontré qué plato está agotado.");
    else acciones.push({ tipo: "agotado", alcance: objetivo.alcance, categoriaId: objetivo.categoria?.id ?? null, productos: objetivo.productos.map((p) => resumenProducto(p)), resumen: "Marcar agotado" });
  } else if (/\b(disponible\w*|volvio|volvieron|repuse|repusimos|hay de nuevo|ya hay|hay otra vez|habilit\w*|reponer|repone\w*)\b/.test(plano)) {
    const objetivo = resolverObjetivo(indice, objetivoDe(plano), plano);
    if (!objetivo) noEntendido.push("No encontré qué plato volvió a haber.");
    else acciones.push({ tipo: "disponible", alcance: objetivo.alcance, categoriaId: objetivo.categoria?.id ?? null, productos: objetivo.productos.map((p) => resumenProducto(p)), resumen: "Marcar disponible" });
  } else if (leerImporte(plano) !== null && /\b(precio|sale|cuesta|pone\w*|cambi\w*|deja\w*|a)\b/.test(plano) && !pct) {
    const importe = leerImporte(plano);
    const objetivo = resolverObjetivo(indice, objetivoDe(plano), plano);
    if (!objetivo || objetivo.alcance !== "productos") noEntendido.push("No encontré qué plato cambia de precio.");
    else if (!(importe > 0)) noEntendido.push("El precio tiene que ser mayor a cero.");
    else acciones.push({ tipo: "precio_fijo", precio: importe, alcance: "productos", productos: objetivo.productos.map((p) => resumenProducto(p, importe)), resumen: "Cambiar precio" });
  } else if (plano) {
    noEntendido.push("No entendí la orden. Probá con: “marcá agotado el bife”, “subí 8 % las bebidas” o “poné el flan a 6500”.");
  }

  return { acciones, respuesta, noEntendido };
}

// --- Recomendaciones según gustos -----------------------------------------------------------

const AMPLIADOS = {
  liviano: { a: ["ensalada", "verdura", "verduras", "pescado", "grill", "vegetales", "atun", "hojas", "tomate", "limon"], en: ["frito", "frita", "fritas", "crema", "queso", "napolitana", "empanado", "manteca", "salsa"] },
  carne: { a: ["bife", "chorizo", "carne", "asado", "lomo", "milanesa", "costilla", "vacio", "matambre", "hamburguesa", "jamon", "res"] },
  pollo: { a: ["pollo", "suprema", "pechuga"] },
  pescado: { a: ["pescado", "salmon", "merluza", "trucha", "atun", "rabas", "mariscos", "calamar"] },
  pasta: { a: ["ravioles", "noquis", "fideos", "tallarines", "pasta", "sorrentinos", "risotto", "lasagna", "canelones"] },
  dulce: { a: ["flan", "brownie", "helado", "chocolate", "dulce", "torta", "postre", "tiramisu"] },
  compartir: { a: ["tabla", "provoleta", "empanadas", "picada", "fiambres", "queso"] },
  abundante: { a: ["bife", "milanesa", "napolitana", "parrilla", "risotto", "ravioles", "tabla"] },
};
const ALCOHOL = ["cerveza", "vino", "malbec", "fernet", "ipa", "copa", "gin", "whisky", "vodka", "trago", "aperitivo", "champagne", "espumante", "tinto", "blanco"];
const RESERVADAS = new Set(["picante", "tacc", "gluten", "lactosa", "alcohol", "carne", "carnes", "celiaco", "celiaca"]);

const tiene = (item, lista) => lista.some((k) => item.nombre.some((t) => parecido(k, t) >= 0.85) || item.descripcion.some((t) => parecido(k, t) >= 0.85));
const esCategoria = (item, ...claves) => claves.some((c) => item.categoria.includes(c));

/**
 * Recomienda platos según lo que cuenta la persona ("algo liviano sin gluten", "tengo hambre, nada picante").
 * `conceptos` y `motivos` son claves que la app traduce a cada idioma.
 */
export function recomendar(texto, indice, { populares = new Map(), max = 4 } = {}) {
  const plano = plegar(texto).replace(/\s+/g, " ");
  const conceptos = [];
  const duros = [];
  const motivos = new Map();
  const nota = (id, clave) => motivos.set(id, [...(motivos.get(id) ?? []), clave]);

  const quiere = (clave, re) => { if (re.test(plano)) { conceptos.push(clave); return true; } return false; };
  const sinTacc = quiere("sin_tacc", /\b(sin tacc|celiac\w*|gluten)\b/);
  const vegano = quiere("vegano", /\bvegan\w*/);
  const vegetariano = quiere("vegetariano", /\b(vegetarian\w*|sin carne|no como carne)\b/);
  const sinLactosa = quiere("sin_lactosa", /\blactosa\b/);
  const noPicante = quiere("no_picante", /\b(no|sin|nada) (me gusta (el|lo) )?picante\b|\bsuave\b|\bnada picante\b/);
  const picante = !noPicante && quiere("picante", /\b(picante|ajiado|con fuerza)\b/);
  const liviano = quiere("liviano", /\b(liviano\w*|light|ligero\w*|leve|fresco\w*|saludable|sano|poco pesado)\b/);
  const carne = quiere("carne", /\b(carne|bife|asado|parrilla|lomo|chorizo|vacuno)\b/);
  const pollo = quiere("pollo", /\bpollo\b/);
  const pescado = quiere("pescado", /\b(pescado|mariscos?|salmon|merluza|trucha|rabas)\b/);
  const pasta = quiere("pasta", /\b(pastas?|fideos|ravioles|noquis|tallarines|sorrentinos)\b/);
  const dulce = quiere("dulce", /\b(dulce|postre|chocolate|helado|merienda)\b/);
  const sinAlcohol = quiere("sin_alcohol", /\bsin alcohol\b|\bno tomo alcohol\b/);
  const bebida = !dulce && quiere("bebida", /\b(tomar|bebida|beber|sed|trago|jugo|limonada|gaseosa|cerveza|vino)\b/);
  const compartir = quiere("compartir", /\b(compartir|picada|para la mesa|para todos|entrada)\b/);
  const barato = quiere("barato", /\b(barato\w*|economic\w*|accesible|poca plata|ahorrar)\b/);
  const abundante = quiere("abundante", /\b(abundante|hambre|hambrient\w*|contundente|llenador\w*|copioso)\b/);

  const tope = /\b(?:hasta|menos de|maximo|no mas de|tengo)\s*\$?\s*([\d.,]+(?:\s*mil)?)/.exec(plano);
  const presupuesto = tope ? leerImporte(tope[1]) : null;

  // Cosas que no le gustan o que no puede comer ("sin cebolla", "no me gusta el queso").
  const evita = [];
  const reNo = /\b(?:no me gusta(?:n)?|no como|odio|detesto|evito|alergic[oa] a|alergia a|intolerante a|sin)\s+(?:el |la |los |las |lo )?([a-z]+)/g;
  for (const m of plano.matchAll(reNo)) if (!RESERVADAS.has(m[1]) && m[1].length > 2) evita.push(m[1]);

  const candidatos = indice.items.filter((i) => i.producto.disponible !== false);
  let lista = candidatos.filter((item) => {
    const etiquetas = item.producto.etiquetas ?? [];
    if (sinTacc && !etiquetas.includes("sin_tacc")) return false;
    if (vegano && !etiquetas.includes("vegano")) return false;
    if (vegetariano && !(etiquetas.includes("vegetariano") || etiquetas.includes("vegano"))) return false;
    if (sinLactosa && !etiquetas.includes("sin_lactosa")) return false;
    if (noPicante && etiquetas.includes("picante")) return false;
    if (sinAlcohol && tiene(item, ALCOHOL)) return false;
    if (presupuesto && Number(item.producto.precio) > presupuesto) return false;
    if (evita.some((e) => tiene(item, [e]))) return false;
    return true;
  });
  const permitidos = lista.map((i) => i.producto.id);
  if (sinTacc) duros.push("sin_tacc");
  if (vegano) duros.push("vegano");
  if (vegetariano) duros.push("vegetariano");
  if (sinLactosa) duros.push("sin_lactosa");

  const puntaje = new Map();
  const suma = (id, valor, clave) => { puntaje.set(id, (puntaje.get(id) ?? 0) + valor); if (clave) nota(id, clave); };
  for (const item of lista) {
    const id = item.producto.id;
    puntaje.set(id, 0);
    const etiquetas = item.producto.etiquetas ?? [];
    for (const e of ["sin_tacc", "vegano", "vegetariano", "sin_lactosa"]) if (conceptos.includes(e) && etiquetas.includes(e)) nota(id, e);
    if (picante && etiquetas.includes("picante")) suma(id, 3, "picante");
    if (liviano) {
      if (tiene(item, AMPLIADOS.liviano.a)) suma(id, 3, "liviano");
      if (tiene(item, AMPLIADOS.liviano.en)) suma(id, -2);
    }
    if (carne && tiene(item, AMPLIADOS.carne.a)) suma(id, 3, "carne");
    if (pollo && tiene(item, AMPLIADOS.pollo.a)) suma(id, 3, "pollo");
    if (pescado && tiene(item, AMPLIADOS.pescado.a)) suma(id, 3, "pescado");
    if (pasta && tiene(item, AMPLIADOS.pasta.a)) suma(id, 3, "pasta");
    if (dulce && (esCategoria(item, "postre", "dulce") || tiene(item, AMPLIADOS.dulce.a))) suma(id, 3, "dulce");
    if (bebida && esCategoria(item, "bebida", "trago", "vino", "cerveza")) suma(id, 3, "bebida");
    if (compartir && (esCategoria(item, "entrada") || tiene(item, AMPLIADOS.compartir.a))) suma(id, 3, "compartir");
    if (abundante && (esCategoria(item, "principal", "plato") || tiene(item, AMPLIADOS.abundante.a))) suma(id, 2, "abundante");
    if (barato && presupuesto === null) suma(id, 0, "barato");
    // Lo que más se pide desempata a favor.
    suma(id, Math.min(1, (populares.get(id) ?? 0) / 20));
  }
  // Pedir "algo dulce" o "algo para tomar" solo trae esa categoría; el resto de pedidos no se limita.
  const foco = dulce || bebida;
  if (foco) lista = lista.filter((i) => (puntaje.get(i.producto.id) ?? 0) >= 3);
  else if (carne || pollo || pescado || pasta || liviano || compartir) {
    const conAfinidad = lista.filter((i) => (puntaje.get(i.producto.id) ?? 0) >= 3);
    if (conAfinidad.length) lista = conAfinidad;
  }
  if (barato) lista.sort((a, b) => Number(a.producto.precio) - Number(b.producto.precio));
  else lista.sort((a, b) => (puntaje.get(b.producto.id) ?? 0) - (puntaje.get(a.producto.id) ?? 0));

  const entendido = conceptos.length > 0 || evita.length > 0 || presupuesto !== null;
  if (!entendido) {
    // Sin pistas: lo más pedido, de categorías distintas.
    const vistas = new Set();
    lista = lista.filter((i) => (vistas.has(i.categoria) ? false : vistas.add(i.categoria) && true));
    lista.sort((a, b) => (populares.get(b.producto.id) ?? 0) - (populares.get(a.producto.id) ?? 0));
  }
  const elegidos = lista.slice(0, max);
  return {
    entendido,
    conceptos,
    evita,
    presupuesto,
    sinResultados: elegidos.length === 0,
    faltanEtiquetas: duros.filter((c) => !indice.productos.some((p) => (p.etiquetas ?? []).includes(c))),
    ids: elegidos.map((i) => i.producto.id),
    /** Platos que cumplen todas las restricciones (sirve para validar lo que sugiera una IA). */
    permitidos,
    motivos: Object.fromEntries(elegidos.map((i) => [i.producto.id, [...new Set(motivos.get(i.producto.id) ?? [])]])),
  };
}

export { dice };

const VERBO_NUEVO = "(?:marc\\w*|pon[ee]\\w*|sub[ie]\\w*|baj[ae]\\w*|aument\\w*|reduc\\w*|descont\\w*|dej[ae]\\w*|cambi\\w*|volv\\w*|se acab\\w*|se termin\\w*|no hay)";

/** Varias órdenes en una frase ("subí 8 % las bebidas y marcá agotado el bife"): se entiende cada una. */
export function interpretarComando(texto, indice) {
  const original = String(texto ?? "");
  const plano = plegar(original);
  const re = new RegExp(`(?:,|;|\\s+y\\s+|\\s+ademas\\s+|\\s+despues\\s+)(?=\\s*${VERBO_NUEVO}\\b)`, "g");
  const trozos = [];
  let desde = 0;
  let m;
  while ((m = re.exec(plano))) { trozos.push(original.slice(desde, m.index)); desde = m.index + m[0].length; }
  trozos.push(original.slice(desde));
  if (trozos.length === 1) return interpretarUno(original, indice);
  const total = { acciones: [], respuesta: null, noEntendido: [] };
  for (const trozo of trozos.filter(Boolean)) {
    const r = interpretarUno(trozo, indice);
    total.acciones.push(...r.acciones);
    total.respuesta ??= r.respuesta;
    total.noEntendido.push(...r.noEntendido);
  }
  return total;
}
