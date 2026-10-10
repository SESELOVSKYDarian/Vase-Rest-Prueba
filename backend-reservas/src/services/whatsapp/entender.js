import { leerNumero, plegar } from "../ia/texto.js";

/**
 * Entender fechas, horas y cantidades escritas como las escribe la gente por WhatsApp
 * ("mañana a las 9 de la noche", "sábado 21:30", "somos cuatro"). Todo puro y en hora de Argentina.
 */
const ZONA = "America/Argentina/Buenos_Aires";
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const dos = (n) => String(n).padStart(2, "0");

/** Fecha y hora de Argentina para un instante: { iso: "2026-10-10", dia: 0..6 (0 = domingo), minutos }. */
export function fechaArgentina(instante = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(instante);
  const d = (t) => partes.find((p) => p.type === t)?.value ?? "";
  return {
    iso: `${d("year")}-${d("month")}-${d("day")}`,
    dia: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(d("weekday")),
    minutos: Number(d("hour")) * 60 + Number(d("minute")),
  };
}

const aUtc = (iso) => { const [a, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const deUtc = (f) => `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
export const sumarDias = (iso, n) => { const f = aUtc(iso); f.setUTCDate(f.getUTCDate() + n); return deUtc(f); };
const diaSemana = (iso) => aUtc(iso).getUTCDay();

function validar(a, m, d) {
  if (m < 1 || m > 12 || d < 1) return null;
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCMonth() === m - 1 && f.getUTCDate() === d ? deUtc(f) : null;
}

/** Fecha mencionada en el texto como "YYYY-MM-DD", o null. `hoy` es la salida de fechaArgentina. */
export function entenderFecha(texto, hoy) {
  const t = plegar(texto);
  if (/\bpasado\s+manana\b/.test(t)) return sumarDias(hoy.iso, 2);
  // "de la mañana" es parte del día, no "el día siguiente".
  if (/\bmanana\b/.test(t.replace(/\b(?:de|por|a)\s+la\s+manana\b/g, " "))) return sumarDias(hoy.iso, 1);
  if (/\b(hoy|esta noche|esta tarde|al mediodia hoy)\b/.test(t)) return hoy.iso;

  const [aHoy, mHoy, dHoy] = hoy.iso.split("-").map(Number);
  // 15/10, 15-10, 15/10/2026, 15/10/26
  const num = /\b(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[/-]\s*(\d{2,4}))?\b/.exec(t);
  if (num) {
    let a = num[3] ? Number(num[3]) : aHoy;
    if (a < 100) a += 2000;
    let f = validar(a, Number(num[2]), Number(num[1]));
    if (f && !num[3] && f < hoy.iso) f = validar(a + 1, Number(num[2]), Number(num[1]));
    return f;
  }
  // 15 de octubre
  const largo = new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s+)?(${MESES.join("|")})\\b(?:\\s*(?:de\\s+)?(\\d{4}))?`).exec(t);
  if (largo) {
    const m = MESES.indexOf(largo[2]) + 1;
    const a = largo[3] ? Number(largo[3]) : aHoy;
    let f = validar(a, m, Number(largo[1]));
    if (f && !largo[3] && f < hoy.iso) f = validar(a + 1, m, Number(largo[1]));
    return f;
  }
  // sábado, el viernes: la próxima vez que cae (hoy mismo si hoy es ese día)
  for (let i = 0; i < DIAS.length; i++) {
    if (new RegExp(`\\b${DIAS[i]}\\b`).test(t)) {
      const falta = (i - hoy.dia + 7) % 7;
      return sumarDias(hoy.iso, falta);
    }
  }
  // "el 15": ese día de este mes (o del que viene si ya pasó)
  const solo = /\bel\s+(\d{1,2})\b(?!\s*[:.h])/.exec(t);
  if (solo) {
    const d = Number(solo[1]);
    let f = validar(aHoy, mHoy, d);
    if (!f || f < hoy.iso) f = validar(mHoy === 12 ? aHoy + 1 : aHoy, mHoy === 12 ? 1 : mHoy + 1, d);
    return f;
  }
  void dHoy;
  return null;
}

const NOCHE = /\b(de la noche|de la tarde|pm|p\.m\.|a la noche|a la tarde|por la noche|por la tarde)\b/;
const MANANA = /\b(de la manana|am|a\.m\.|por la manana)\b/;

/** Hora mencionada como "HH:MM", o null. Con `sola`, un número suelto ("9", "21") se toma como hora. */
export function entenderHora(texto, { sola = false } = {}) {
  const t = plegar(texto);
  const noche = NOCHE.test(t);
  const manana = MANANA.test(t);
  const ajustar = (h) => (noche && h >= 1 && h <= 11 ? h + 12 : h);
  let m = /\b([01]?\d|2[0-3])\s*[:.h]\s*([0-5]\d)\b/.exec(t);
  if (m) return `${dos(ajustar(Number(m[1])))}:${m[2]}`;
  if (/\bmediodia\b/.test(t)) return "12:00";
  if (/\bmedianoche\b/.test(t)) return "00:00";
  m = /\b(?:a las|a la|las|desde las)\s*(\d{1,2})\b/.exec(t) ?? /\b(\d{1,2})\s*(?:hs|h|horas|am|pm)\b/.exec(t);
  if (m && Number(m[1]) <= 24) {
    let h = Number(m[1]);
    h = h === 24 ? 0 : ajustar(h);
    // Sin aclaración, una cena a "las 9" es 21:00; "las 12" y "las 13" ya son mediodía.
    if (!noche && !manana && h >= 1 && h <= 11 && /\b(?:a las|a la|las)\b/.test(t)) h += 12;
    return `${dos(h)}:00`;
  }
  if (sola) {
    m = /^\s*(\d{1,2})\s*$/.exec(t);
    if (m && Number(m[1]) <= 24) {
      let h = Number(m[1]) === 24 ? 0 : Number(m[1]);
      if (!manana && h >= 1 && h <= 11) h += 12;
      return `${dos(h)}:00`;
    }
  }
  return null;
}

/** Cantidad de personas: "4 personas", "somos cuatro", "para 6". Con `sola`, el primer número del mensaje. */
export function entenderPersonas(texto, { sola = false } = {}) {
  const t = plegar(texto).replace(/[,.]/g, " ");
  let m = /\b(\d{1,2})\s*(?:personas|persona|pax|comensales|lugares|cubiertos|amigos)\b/.exec(t);
  if (m) return Number(m[1]);
  m = /\b(?:somos|para|seremos|mesa de|mesa para|ser[ia]amos)\s+(\w+)\b/.exec(t);
  if (m) { const n = leerNumero(m[1]); if (n && n < 100) return n; }
  m = /\b(\w+)\s+(?:personas|persona|pax|comensales)\b/.exec(t);
  if (m) { const n = leerNumero(m[1]); if (n && n < 100) return n; }
  if (sola) {
    for (const palabra of t.split(/\s+/)) { const n = leerNumero(palabra); if (n && n >= 1 && n < 100) return n; }
  }
  return null;
}

export const entenderSi = (texto) => /^(si|sii+|sip|dale|ok|okey|oka|listo|perfecto|confirmo|confirmar|confirmado|correcto|de una|obvio|claro|joya|va|bueno)\b/.test(plegar(texto).trim());
export const entenderNo = (texto) => /^(no|nop|nel|nada|mejor no|cancelar|cancela|cancelalo|dejalo|olvidalo)\b/.test(plegar(texto).trim());

/**
 * Hora de retiro: "en 30 minutos", "en una hora", "a las 21:15", "ahora". Devuelve minutos desde medianoche
 * del día de `ahora` (puede pasar de 1440 si cae pasada la medianoche) o null si no se entiende.
 */
export function entenderRetiro(texto, ahoraMin) {
  const t = plegar(texto);
  if (/\b(ahora|ya|lo antes posible|cuanto antes|apenas|urgente)\b/.test(t)) return ahoraMin;
  let m = /\ben\s+(\d{1,3})\s*(?:min|minutos|m)\b/.exec(t);
  if (m) return ahoraMin + Number(m[1]);
  m = /\ben\s+(?:una|1)\s+hora\b/.exec(t);
  if (m) return ahoraMin + 60;
  m = /\ben\s+(?:media hora)\b/.exec(t);
  if (m) return ahoraMin + 30;
  m = /\ben\s+(\d{1,2})\s*(?:horas|hs|h)\b/.exec(t);
  if (m) return ahoraMin + Number(m[1]) * 60;
  const hora = entenderHora(texto, { sola: true });
  if (hora) {
    const [h, mi] = hora.split(":").map(Number);
    let mins = h * 60 + mi;
    if (mins < ahoraMin - 5) mins += 24 * 60;
    return mins;
  }
  return null;
}

export const hhmm = (minutos) => `${dos(Math.floor((minutos % 1440) / 60))}:${dos(minutos % 60)}`;

const NOMBRE_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** "sábado 18/10" para decirle al cliente el día. */
export function fechaLegible(iso, hoy) {
  if (iso === hoy.iso) return "hoy";
  if (iso === sumarDias(hoy.iso, 1)) return "mañana";
  const [, m, d] = iso.split("-");
  return `${NOMBRE_DIA[diaSemana(iso)]} ${Number(d)}/${Number(m)}`;
}
