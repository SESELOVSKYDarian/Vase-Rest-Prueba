import { pool } from "../config/database.js";

/**
 * Ajustes de la carta y del QR de la mesa. Se guardan como un documento en `salon_layouts`
 * (mismo patrón que el plano y el diseño): un solo lugar editable desde la app.
 */
const CONFIG_ID = "carta-config";
const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

export const CONFIG_DEFECTO = {
  nombreLocal: "",
  // Hoy el backend suma 21 % encima del precio de la carta; con `true` el precio ya lo incluye.
  ivaIncluido: false,
  idiomas: ["en", "pt"],
  pedidosQr: true,
  happyHour: { activo: false, dias: [1, 2, 3, 4, 5], desde: "18:00", hasta: "20:00", descuento: 20, categorias: [] },
  pago: { alias: "", titular: "", mensaje: "" },
  propinas: [0, 10, 15],
  // Reservas por WhatsApp y web: cuánto dura una mesa, en qué horario se reserva y hasta cuántas personas.
  reservas: { activas: true, duracionMin: 90, desde: "12:00", hasta: "23:30", maxPersonas: 12, anticipacionMin: 60 },
  // Pedidos para llevar por WhatsApp: entran directo a cocina; se pagan al retirar.
  llevar: { activo: true, demoraMin: 30, maxUnidades: 30 },
  // Datos del local que salen en el ticket y deciden qué tipo de factura corresponde.
  fiscal: { razonSocial: "", cuit: "", condicionIva: "responsable_inscripto", domicilio: "", pedirFactura: true },
};

const hora = (v, def) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : def);
const entero = (v, min, max, def) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : def);
const texto = (v, max) => String(v ?? "").trim().slice(0, max);

/** Acepta cualquier entrada y devuelve una configuración válida (lo inválido vuelve al valor por defecto). */
export function normalizarConfig(entrada = {}) {
  const base = CONFIG_DEFECTO;
  const e = entrada && typeof entrada === "object" ? entrada : {};
  const hh = e.happyHour && typeof e.happyHour === "object" ? e.happyHour : {};
  const pago = e.pago && typeof e.pago === "object" ? e.pago : {};
  const fiscal = e.fiscal && typeof e.fiscal === "object" ? e.fiscal : {};
  const res = e.reservas && typeof e.reservas === "object" ? e.reservas : {};
  const llevar = e.llevar && typeof e.llevar === "object" ? e.llevar : {};
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return {
    nombreLocal: texto(e.nombreLocal ?? base.nombreLocal, 60),
    ivaIncluido: e.ivaIncluido === undefined ? base.ivaIncluido : e.ivaIncluido === true,
    idiomas: Array.isArray(e.idiomas) ? [...new Set(e.idiomas.filter((i) => i === "en" || i === "pt"))] : base.idiomas,
    pedidosQr: e.pedidosQr === undefined ? base.pedidosQr : e.pedidosQr === true,
    happyHour: {
      activo: hh.activo === true,
      dias: Array.isArray(hh.dias) ? [...new Set(hh.dias.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : base.happyHour.dias,
      desde: hora(hh.desde, base.happyHour.desde),
      hasta: hora(hh.hasta, base.happyHour.hasta),
      descuento: entero(hh.descuento, 1, 90, base.happyHour.descuento),
      categorias: Array.isArray(hh.categorias) ? hh.categorias.filter((c) => uuid.test(String(c))) : [],
    },
    pago: { alias: texto(pago.alias, 40), titular: texto(pago.titular, 60), mensaje: texto(pago.mensaje, 120) },
    reservas: {
      activas: res.activas === undefined ? base.reservas.activas : res.activas === true,
      duracionMin: entero(res.duracionMin, 30, 300, base.reservas.duracionMin),
      desde: hora(res.desde, base.reservas.desde),
      hasta: hora(res.hasta, base.reservas.hasta),
      maxPersonas: entero(res.maxPersonas, 1, 60, base.reservas.maxPersonas),
      anticipacionMin: entero(res.anticipacionMin, 0, 1440, base.reservas.anticipacionMin),
    },
    llevar: {
      activo: llevar.activo === undefined ? base.llevar.activo : llevar.activo === true,
      demoraMin: entero(llevar.demoraMin, 5, 240, base.llevar.demoraMin),
      maxUnidades: entero(llevar.maxUnidades, 1, 200, base.llevar.maxUnidades),
    },
    fiscal: {
      razonSocial: texto(fiscal.razonSocial, 100),
      cuit: texto(fiscal.cuit, 13).replace(/[^\d-]/g, ""),
      condicionIva: ["responsable_inscripto", "monotributo", "exento"].includes(fiscal.condicionIva) ? fiscal.condicionIva : base.fiscal.condicionIva,
      domicilio: texto(fiscal.domicilio, 160),
      pedirFactura: fiscal.pedirFactura === undefined ? base.fiscal.pedirFactura : fiscal.pedirFactura === true,
    },
    propinas: Array.isArray(e.propinas) ? [...new Set(e.propinas.map((p) => entero(p, 0, 30, 0)))].slice(0, 4) : base.propinas,
  };
}

let cache = { en: 0, valor: null };

export async function leerConfig() {
  if (cache.valor && Date.now() - cache.en < 5000) return cache.valor;
  const r = await pool.query("select payload from salon_layouts where id = $1", [CONFIG_ID]);
  cache = { en: Date.now(), valor: normalizarConfig(r.rows[0]?.payload) };
  return cache.valor;
}

export async function guardarConfig(entrada) {
  const valor = normalizarConfig(entrada);
  await pool.query(
    `insert into salon_layouts (id, payload, updated_at) values ($1, $2::jsonb, now())
     on conflict (id) do update set payload = excluded.payload, updated_at = now()`,
    [CONFIG_ID, JSON.stringify(valor)],
  );
  cache = { en: Date.now(), valor };
  return valor;
}

/** Día de la semana (0 = domingo) y minutos desde medianoche, en hora argentina. */
export function ahoraArgentina(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: ZONA_HORARIA, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(fecha);
  const dato = (tipo) => partes.find((p) => p.type === tipo)?.value ?? "";
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dato("weekday"));
  return { dia, minutos: Number(dato("hour")) * 60 + Number(dato("minute")) };
}

const aMinutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** ¿Está en vigencia el happy hour en este momento? Entiende horarios que cruzan la medianoche (22:00–02:00). */
export function happyHourVigente(config, fecha = new Date()) {
  const hh = config.happyHour;
  if (!hh?.activo || !hh.dias.length) return false;
  const { dia, minutos } = ahoraArgentina(fecha);
  const desde = aMinutos(hh.desde);
  const hasta = aMinutos(hh.hasta);
  if (desde === hasta) return false;
  if (desde < hasta) return hh.dias.includes(dia) && minutos >= desde && minutos < hasta;
  return (hh.dias.includes(dia) && minutos >= desde) || (hh.dias.includes((dia + 6) % 7) && minutos < hasta);
}

/** Precio que rige ahora para un plato (con happy hour si corresponde), en pesos con dos decimales. */
export function precioVigente(producto, config, fecha = new Date()) {
  const lista = Number(producto.precio ?? 0);
  const categoriaId = producto.categoria_id ?? producto.categoriaId ?? null;
  const aplica = happyHourVigente(config, fecha) && (config.happyHour.categorias.length === 0 || config.happyHour.categorias.includes(categoriaId));
  if (!aplica) return { precio: lista, lista, happy: false };
  const precio = Math.round(lista * (1 - config.happyHour.descuento / 100) * 100) / 100;
  return { precio, lista, happy: true };
}

/** Subtotal, IVA y total de un pedido según si los precios de la carta ya incluyen IVA. */
export function totalesDe(subtotal, config) {
  const s = Number(subtotal) || 0;
  if (config.ivaIncluido) {
    const impuestos = Math.round((s - s / 1.21) * 100) / 100;
    return { subtotal: s, impuestos, total: s };
  }
  const impuestos = Math.round(s * 0.21 * 100) / 100;
  return { subtotal: s, impuestos, total: Math.round((s + impuestos) * 100) / 100 };
}
