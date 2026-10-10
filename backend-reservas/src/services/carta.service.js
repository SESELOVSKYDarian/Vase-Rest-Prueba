import { pool } from "../config/database.js";
import { happyHourVigente, leerConfig, precioVigente } from "./cartaConfig.service.js";
import { IDIOMAS, traducirTextos } from "./ia/traducir.js";
import { plegar } from "./ia/texto.js";

export const ETIQUETAS = ["sin_tacc", "vegano", "vegetariano", "sin_lactosa", "picante"];

/** Carta completa tal como está en la base (sin traducir ni aplicar happy hour). */
export async function leerCatalogo() {
  const [categorias, productos] = await Promise.all([
    pool.query("select id, nombre, orden from categorias where coalesce(activo, true) order by orden nulls last, nombre"),
    pool.query(`select id, categoria_id, nombre, descripcion, precio, imagen_url, disponible, coalesce(etiquetas, '{}') as etiquetas
                from productos where coalesce(activo, true) order by nombre`),
  ]);
  return {
    categorias: categorias.rows.map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden ?? 0 })),
    productos: productos.rows.map((p) => ({
      id: p.id,
      categoriaId: p.categoria_id,
      nombre: p.nombre,
      descripcion: p.descripcion ?? "",
      precio: Number(p.precio),
      imagenUrl: p.imagen_url ?? null,
      disponible: p.disponible !== false,
      etiquetas: (p.etiquetas ?? []).filter((e) => ETIQUETAS.includes(e)),
    })),
  };
}

/** Cuánto se pidió cada plato en los últimos 30 días: Map(productoId → unidades). */
export async function populares() {
  const r = await pool.query(
    `select pi.producto_id, sum(pi.cantidad) as n
       from pedido_items pi join pedidos p on p.id = pi.pedido_id
      where p.abierto_en > now() - interval '30 days' group by pi.producto_id`,
  );
  return new Map(r.rows.map((f) => [f.producto_id, Number(f.n)]));
}

const rol = (nombre) => {
  const n = plegar(nombre);
  if (/entrada|picada|para empezar/.test(n)) return "entrada";
  if (/principal|plato|parrilla|pasta|minuta/.test(n)) return "principal";
  if (/bebida|trago|vino|cerveza|cafe|gaseosa/.test(n)) return "bebida";
  if (/postre|dulce|helado/.test(n)) return "postre";
  return "otro";
};

/**
 * Qué sugerir junto a cada plato: primero lo que más se pidió en la misma mesa, y si hay pocos datos,
 * una bebida o un postre según el tipo de plato.
 */
export async function acompanamientos(productos, categorias, popularidad) {
  const r = await pool.query(
    `select a.producto_id as a, b.producto_id as b, count(distinct a.pedido_id) as n
       from pedido_items a join pedido_items b on a.pedido_id = b.pedido_id and a.producto_id <> b.producto_id
       join pedidos p on p.id = a.pedido_id
      where p.abierto_en > now() - interval '90 days' group by a.producto_id, b.producto_id having count(distinct a.pedido_id) >= 2`,
  );
  const juntos = new Map();
  for (const f of r.rows) juntos.set(f.a, [...(juntos.get(f.a) ?? []), { id: f.b, n: Number(f.n) }]);

  const porId = new Map(productos.map((p) => [p.id, p]));
  const rolDe = new Map(categorias.map((c) => [c.id, rol(c.nombre)]));
  const mejorDe = (tipo, excluir) => productos
    .filter((p) => p.disponible && rolDe.get(p.categoriaId) === tipo && !excluir.has(p.id))
    .sort((a, b) => (popularidad.get(b.id) ?? 0) - (popularidad.get(a.id) ?? 0) || a.precio - b.precio)[0];

  const resultado = new Map();
  for (const p of productos) {
    const propio = rolDe.get(p.categoriaId);
    const elegidos = [];
    for (const { id } of (juntos.get(p.id) ?? []).sort((x, y) => y.n - x.n)) {
      const otro = porId.get(id);
      if (otro?.disponible && rolDe.get(otro.categoriaId) !== propio && elegidos.length < 2) elegidos.push(id);
    }
    const quiere = propio === "entrada" ? ["bebida"] : propio === "principal" ? ["bebida", "postre"] : propio === "postre" ? ["bebida"] : [];
    for (const tipo of quiere) {
      if (elegidos.length >= 2) break;
      if (elegidos.some((id) => rolDe.get(porId.get(id)?.categoriaId) === tipo)) continue;
      const m = mejorDe(tipo, new Set([p.id, ...elegidos]));
      if (m) elegidos.push(m.id);
    }
    if (p.disponible) resultado.set(p.id, elegidos);
  }
  return resultado;
}

/** La carta que ve el cliente desde el QR: precios de este momento, idioma, más pedidos y acompañamientos. */
export async function construirCartaPublica({ idioma = "es" } = {}) {
  const [config, catalogo, popularidad] = await Promise.all([leerConfig(), leerCatalogo(), populares()]);
  const hh = config.happyHour;
  const vigente = happyHourVigente(config);
  const acomp = await acompanamientos(catalogo.productos, catalogo.categorias, popularidad);

  const orden = [...popularidad.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
  const masPedidos = new Set(orden);

  let traducir = (t) => t;
  const lang = IDIOMAS.includes(idioma) && config.idiomas.includes(idioma) ? idioma : "es";
  if (lang !== "es") {
    const mapa = await traducirTextos([...catalogo.productos.flatMap((p) => [p.nombre, p.descripcion]), ...catalogo.categorias.map((c) => c.nombre)], lang);
    traducir = (t) => mapa.get(String(t ?? "").trim()) ?? t;
  }

  return {
    local: config.nombreLocal,
    idioma: lang,
    idiomas: ["es", ...config.idiomas],
    ivaIncluido: config.ivaIncluido,
    pedidosQr: config.pedidosQr,
    happyHour: { activo: hh.activo, vigente, descuento: hh.descuento, desde: hh.desde, hasta: hh.hasta, dias: hh.dias },
    categorias: catalogo.categorias.map((c) => ({ ...c, nombre: traducir(c.nombre) })),
    productos: catalogo.productos.map((p) => {
      const { precio, lista, happy } = precioVigente({ ...p, categoria_id: p.categoriaId }, config);
      return {
        id: p.id,
        categoriaId: p.categoriaId,
        nombre: traducir(p.nombre),
        descripcion: traducir(p.descripcion),
        precio,
        precioLista: lista,
        happy,
        imagenUrl: p.imagenUrl,
        disponible: p.disponible,
        etiquetas: p.etiquetas,
        masPedido: masPedidos.has(p.id),
        acompanamientos: acomp.get(p.id) ?? [],
      };
    }),
  };
}
