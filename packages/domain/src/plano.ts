import type { FormaMesa, Mesa } from './mesa';

/**
 * Plano del salón. Todas las medidas están en CENTÍMETROS reales: una mesa de 4 mide ~90 cm,
 * una silla ~45 cm. Así el plano se ve igual en cualquier pantalla y la IA puede leerlo de un dibujo.
 */
export interface MesaEnPlano {
  mesaId: string;
  x: number; // centro
  y: number;
  rot: number; // grados
  forma: FormaMesa;
  ancho: number;
  alto: number;
  asientos: number;
}

export type ColorZona = 'salvia' | 'arena' | 'cielo' | 'terracota' | 'lavanda' | 'grafito';

export interface ZonaPlano {
  id: string;
  nombre: string;
  color: ColorZona;
  x: number; // esquina superior izquierda
  y: number;
  w: number;
  h: number;
}

export type TipoElemento = 'barra' | 'pared' | 'puerta' | 'ventana' | 'planta' | 'columna' | 'cocina' | 'bano' | 'caja';

export interface ElementoPlano {
  id: string;
  tipo: TipoElemento;
  x: number; // centro
  y: number;
  w: number;
  h: number;
  rot: number;
  etiqueta?: string;
}

export interface Plano {
  version: 2;
  ancho: number;
  alto: number;
  zonas: ZonaPlano[];
  mesas: MesaEnPlano[];
  elementos: ElementoPlano[];
  fondo: { url: string; opacidad: number } | null;
}

export const COLORES_ZONA: readonly ColorZona[] = ['salvia', 'arena', 'cielo', 'terracota', 'lavanda', 'grafito'];

export const ETIQUETA_ELEMENTO: Record<TipoElemento, string> = {
  barra: 'Barra',
  pared: 'Pared',
  puerta: 'Puerta',
  ventana: 'Ventana',
  planta: 'Planta',
  columna: 'Columna',
  cocina: 'Cocina',
  bano: 'Baños',
  caja: 'Caja',
};

/** Medidas por defecto de cada elemento al agregarlo (cm). */
export const MEDIDA_ELEMENTO: Record<TipoElemento, { w: number; h: number }> = {
  barra: { w: 360, h: 70 },
  pared: { w: 300, h: 15 },
  puerta: { w: 90, h: 15 },
  ventana: { w: 160, h: 12 },
  planta: { w: 60, h: 60 },
  columna: { w: 40, h: 40 },
  cocina: { w: 300, h: 220 },
  bano: { w: 200, h: 160 },
  caja: { w: 140, h: 70 },
};

export const MEDIDA_SILLA = { w: 44, h: 40, separacion: 10 } as const;

/** Medidas de mesa según forma y cantidad de lugares. */
export function medidaMesa(forma: FormaMesa, asientos: number): { ancho: number; alto: number } {
  const n = Math.max(1, Math.round(asientos));
  if (forma === 'circular') {
    const d = n <= 2 ? 70 : n <= 4 ? 90 : n <= 6 ? 120 : 150;
    return { ancho: d, alto: d };
  }
  if (forma === 'cuadrada') {
    const l = n <= 2 ? 70 : n <= 4 ? 85 : 110;
    return { ancho: l, alto: l };
  }
  // rectangular: el largo crece con los lugares por lado
  const porLado = Math.max(1, Math.ceil(n / 2));
  return { ancho: Math.max(120, porLado * 60 + 20), alto: 80 };
}

export interface PosicionSilla {
  x: number; // relativo al centro de la mesa, antes de rotar
  y: number;
  rot: number; // la silla mira hacia la mesa
}

/** Dónde van las sillas alrededor de una mesa, ya sin superponerse. */
export function posicionesSillas(mesa: Pick<MesaEnPlano, 'forma' | 'ancho' | 'alto' | 'asientos'>): PosicionSilla[] {
  const n = Math.max(0, Math.round(mesa.asientos));
  if (n === 0) return [];
  const sep = MEDIDA_SILLA.separacion + MEDIDA_SILLA.h / 2;
  if (mesa.forma === 'circular') {
    const r = mesa.ancho / 2 + sep;
    return Array.from({ length: n }, (_, i) => {
      const ang = (-90 + (360 / n) * i) * (Math.PI / 180);
      return { x: Math.cos(ang) * r, y: Math.sin(ang) * r, rot: (360 / n) * i };
    });
  }
  const sillas: PosicionSilla[] = [];
  const lado = (cantidad: number, largo: number, fijo: number, rot: number, horizontal: boolean) => {
    for (let i = 0; i < cantidad; i++) {
      const t = -largo / 2 + (largo / cantidad) * (i + 0.5);
      sillas.push(horizontal ? { x: t, y: fijo, rot } : { x: fijo, y: t, rot });
    }
  };
  if (mesa.forma === 'cuadrada') {
    // Hasta 4: una por lado. Más: se reparten de a dos por lado.
    const porLado = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) porLado[i % 4] += 1;
    lado(porLado[0], mesa.ancho, -(mesa.alto / 2 + sep), 0, true);
    lado(porLado[1], mesa.alto, mesa.ancho / 2 + sep, 90, false);
    lado(porLado[2], mesa.ancho, mesa.alto / 2 + sep, 180, true);
    lado(porLado[3], mesa.alto, -(mesa.ancho / 2 + sep), 270, false);
    return sillas;
  }
  // rectangular: lados largos primero; cabeceras solo si sobran (número impar o muchas).
  const cabeceras = n % 2 === 1 ? 1 : n >= 8 ? 2 : 0;
  const largos = n - cabeceras;
  lado(Math.ceil(largos / 2), mesa.ancho, -(mesa.alto / 2 + sep), 0, true);
  lado(Math.floor(largos / 2), mesa.ancho, mesa.alto / 2 + sep, 180, true);
  if (cabeceras >= 1) sillas.push({ x: mesa.ancho / 2 + sep, y: 0, rot: 90 });
  if (cabeceras === 2) sillas.push({ x: -(mesa.ancho / 2 + sep), y: 0, rot: 270 });
  return sillas;
}

export function planoVacio(ancho = 1200, alto = 800): Plano {
  return { version: 2, ancho, alto, zonas: [], mesas: [], elementos: [], fondo: null };
}

let contador = 0;
export const nuevoId = (prefijo: string) => `${prefijo}-${Date.now().toString(36)}-${(contador++).toString(36)}`;

/** Zona que contiene el centro de una mesa (la primera, si se superponen). */
export function zonaDeMesa(plano: Pick<Plano, 'zonas'>, mesa: Pick<MesaEnPlano, 'x' | 'y'>): ZonaPlano | null {
  return plano.zonas.find((z) => mesa.x >= z.x && mesa.x <= z.x + z.w && mesa.y >= z.y && mesa.y <= z.y + z.h) ?? null;
}

const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const FORMAS: readonly FormaMesa[] = ['circular', 'cuadrada', 'rectangular'];
const TIPOS: readonly TipoElemento[] = Object.keys(ETIQUETA_ELEMENTO) as TipoElemento[];

/** Lee un plano guardado sin confiar en su forma: descarta lo inválido en vez de romper la pantalla. */
export function normalizarPlano(entrada: unknown): Plano | null {
  if (!entrada || typeof entrada !== 'object') return null;
  const p = entrada as Record<string, unknown>;
  if (p.version !== 2) return null;
  const ancho = Math.min(10000, Math.max(200, num(p.ancho, 1200)));
  const alto = Math.min(10000, Math.max(200, num(p.alto, 800)));
  const arr = (v: unknown) => (Array.isArray(v) ? v : []) as Array<Record<string, unknown>>;
  const mesas: MesaEnPlano[] = arr(p.mesas)
    .filter((m) => typeof m.mesaId === 'string')
    .map((m) => {
      const forma = FORMAS.includes(m.forma as FormaMesa) ? (m.forma as FormaMesa) : 'cuadrada';
      const asientos = Math.min(20, Math.max(1, Math.round(num(m.asientos, 4))));
      const base = medidaMesa(forma, asientos);
      return { mesaId: m.mesaId as string, x: num(m.x, ancho / 2), y: num(m.y, alto / 2), rot: num(m.rot, 0), forma, asientos, ancho: num(m.ancho, base.ancho), alto: num(m.alto, base.alto) };
    });
  const zonas: ZonaPlano[] = arr(p.zonas)
    .filter((z) => typeof z.id === 'string')
    .map((z) => ({
      id: z.id as string,
      nombre: typeof z.nombre === 'string' && z.nombre.trim() ? (z.nombre as string).slice(0, 40) : 'Zona',
      color: COLORES_ZONA.includes(z.color as ColorZona) ? (z.color as ColorZona) : 'salvia',
      x: num(z.x, 0), y: num(z.y, 0), w: Math.max(60, num(z.w, 300)), h: Math.max(60, num(z.h, 200)),
    }));
  const elementos: ElementoPlano[] = arr(p.elementos)
    .filter((e) => typeof e.id === 'string' && TIPOS.includes(e.tipo as TipoElemento))
    .map((e) => {
      const tipo = e.tipo as TipoElemento;
      return { id: e.id as string, tipo, x: num(e.x, ancho / 2), y: num(e.y, alto / 2), w: Math.max(5, num(e.w, MEDIDA_ELEMENTO[tipo].w)), h: Math.max(5, num(e.h, MEDIDA_ELEMENTO[tipo].h)), rot: num(e.rot, 0), etiqueta: typeof e.etiqueta === 'string' ? (e.etiqueta as string).slice(0, 30) : undefined };
    });
  const fondoRaw = p.fondo as Record<string, unknown> | null | undefined;
  const fondo = fondoRaw && typeof fondoRaw.url === 'string' ? { url: fondoRaw.url as string, opacidad: Math.min(1, Math.max(0.05, num(fondoRaw.opacidad, 0.5))) } : null;
  return { version: 2, ancho, alto, zonas, mesas, elementos, fondo };
}

/**
 * Primer plano a partir de las mesas existentes (posiciones del editor anterior, que estaban
 * en píxeles ≈ cm). Cada zona distinta se dibuja alrededor de sus mesas.
 */
export function planoDesdeMesas(mesas: readonly Mesa[]): Plano {
  const plano = planoVacio();
  if (mesas.length === 0) return plano;
  // Posiciones fuera de un rango creíble (restos de datos corruptos) se tratan como "sin ubicar".
  const creible = (m: Mesa) => m.posicion.x > 0 && m.posicion.y > 0 && m.posicion.x < 10000 && m.posicion.y < 10000;
  const conPos = mesas.every(creible);
  const colocadas = mesas.map((m, i) => {
    const asientos = Math.max(1, m.capacidad || 4);
    const medida = medidaMesa(m.forma, asientos);
    const x = conPos ? m.posicion.x : 200 + (i % 5) * 200;
    const y = conPos ? m.posicion.y : 200 + Math.floor(i / 5) * 200;
    return { mesaId: m.id, x, y, rot: 0, forma: m.forma, asientos, ...medida };
  });
  // Encuadre: corre todo para que haya 120 cm de margen y ajusta el tamaño del salón.
  const minX = Math.min(...colocadas.map((m) => m.x - m.ancho / 2 - 60));
  const minY = Math.min(...colocadas.map((m) => m.y - m.alto / 2 - 60));
  const dx = 120 - minX;
  const dy = 160 - minY;
  colocadas.forEach((m) => { m.x += dx; m.y += dy; });
  plano.mesas = colocadas;
  plano.ancho = Math.max(800, Math.ceil(Math.max(...colocadas.map((m) => m.x + m.ancho / 2)) + 180));
  plano.alto = Math.max(600, Math.ceil(Math.max(...colocadas.map((m) => m.y + m.alto / 2)) + 180));

  const porZona = new Map<string, MesaEnPlano[]>();
  colocadas.forEach((m) => {
    const zona = mesas.find((x) => x.id === m.mesaId)?.zona || 'Salón';
    porZona.set(zona, [...(porZona.get(zona) ?? []), m]);
  });
  let i = 0;
  porZona.forEach((lista, nombre) => {
    const x0 = Math.min(...lista.map((m) => m.x - m.ancho / 2)) - 90;
    const y0 = Math.min(...lista.map((m) => m.y - m.alto / 2)) - 110;
    const x1 = Math.max(...lista.map((m) => m.x + m.ancho / 2)) + 90;
    const y1 = Math.max(...lista.map((m) => m.y + m.alto / 2)) + 90;
    plano.zonas.push({ id: nuevoId('zona'), nombre: tituloZona(nombre), color: COLORES_ZONA[i++ % COLORES_ZONA.length], x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  });
  return plano;
}

/** "SALÓN PRINCIPAL" → "Salón principal" */
export function tituloZona(nombre: string): string {
  const limpio = nombre.trim().toLowerCase();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/** Caja que ocupa cada cosa del plano, con las sillas incluidas (cm, sin rotar). */
function cajasOcupadas(plano: Pick<Plano, 'mesas' | 'elementos'>) {
  const silla = MEDIDA_SILLA.h + MEDIDA_SILLA.separacion;
  return [
    ...plano.mesas.map((m) => ({ x: m.x, y: m.y, w: m.ancho + silla * 2, h: m.alto + silla * 2 })),
    // Las puertas reservan el barrido de la hoja.
    ...plano.elementos.map((e) => { const l = Math.max(e.w, e.h) * (e.tipo === 'puerta' ? 2 : 1); return { x: e.x, y: e.y, w: l, h: l }; }),
  ];
}

/**
 * Lugar libre más cercano a `cerca` para algo de `w`×`h` (centro), sin pisar mesas ni objetos
 * y dentro del local. Si no hay lugar, devuelve `cerca`.
 */
export function lugarLibre(plano: Pick<Plano, 'ancho' | 'alto' | 'mesas' | 'elementos'>, w: number, h: number, cerca: { x: number; y: number }, margen = 20) {
  const cajas = cajasOcupadas(plano);
  const libre = (x: number, y: number) =>
    x - w / 2 >= margen && y - h / 2 >= margen && x + w / 2 <= plano.ancho - margen && y + h / 2 <= plano.alto - margen &&
    cajas.every((c) => Math.abs(c.x - x) * 2 >= c.w + w + margen || Math.abs(c.y - y) * 2 >= c.h + h + margen);
  const paso = 20;
  const x0 = ajustar(cerca.x);
  const y0 = ajustar(cerca.y);
  if (libre(x0, y0)) return { x: x0, y: y0 };
  const maxAnillo = Math.ceil(Math.max(plano.ancho, plano.alto) / paso);
  for (let r = 1; r <= maxAnillo; r++) {
    let mejor: { x: number; y: number; d: number } | null = null;
    for (let i = -r; i <= r; i++) {
      for (const [dx, dy] of [[i, -r], [i, r], [-r, i], [r, i]] as const) {
        const x = x0 + dx * paso;
        const y = y0 + dy * paso;
        const d = dx * dx + dy * dy;
        if ((!mejor || d < mejor.d) && libre(x, y)) mejor = { x, y, d };
      }
    }
    if (mejor) return { x: mejor.x, y: mejor.y };
  }
  return { x: x0, y: y0 };
}

/** Ajusta a una grilla de `paso` cm (imán al soltar). */
export const ajustar = (valor: number, paso = 10) => Math.round(valor / paso) * paso;

/** Resultado de la lectura con IA (posiciones normalizadas 0–1000 sobre la imagen). */
export interface AnalisisPlano {
  es_plano: boolean;
  local: { ancho_m: number; largo_m: number };
  zonas: Array<{ nombre: string; x: number; y: number; w: number; h: number }>;
  mesas: Array<{ forma: FormaMesa; lugares: number; x: number; y: number; rot: number; numero: number | null }>;
  elementos: Array<{ tipo: TipoElemento; x: number; y: number; w: number; h: number; rot: number; etiqueta: string | null }>;
  notas: string;
}

/**
 * Convierte la lectura de la IA en un plano a escala real (cm). Las mesas detectadas se asignan
 * a mesas existentes por número cuando coincide; las demás quedan como mesas nuevas.
 */
export function planoDesdeAnalisis(
  analisis: AnalisisPlano,
  mesas: readonly Mesa[],
  fondo: Plano['fondo'],
): { plano: Plano; numeros: Record<string, number> } {
  const ancho = Math.min(10000, Math.max(400, Math.round((analisis.local.ancho_m || 12) * 100)));
  const alto = Math.min(10000, Math.max(300, Math.round((analisis.local.largo_m || 8) * 100)));
  const sx = (v: number) => (Math.min(1000, Math.max(0, v)) / 1000) * ancho;
  const sy = (v: number) => (Math.min(1000, Math.max(0, v)) / 1000) * alto;
  const plano = planoVacio(ancho, alto);
  plano.fondo = fondo;

  plano.zonas = analisis.zonas.map((z, i) => ({
    id: nuevoId('zona'),
    nombre: (z.nombre || `Zona ${i + 1}`).slice(0, 40),
    color: COLORES_ZONA[i % COLORES_ZONA.length],
    x: ajustar(sx(z.x)), y: ajustar(sy(z.y)), w: Math.max(100, ajustar(sx(z.w))), h: Math.max(100, ajustar(sy(z.h))),
  }));

  const disponibles = new Map(mesas.map((m) => [m.numero, m]));
  const numeros: Record<string, number> = {};
  let siguiente = Math.max(0, ...mesas.map((m) => m.numero)) + 1;
  plano.mesas = analisis.mesas.map((m) => {
    const forma = (['circular', 'cuadrada', 'rectangular'] as const).includes(m.forma) ? m.forma : 'cuadrada';
    const asientos = Math.min(20, Math.max(1, Math.round(m.lugares || 4)));
    const existente = m.numero != null ? disponibles.get(m.numero) : undefined;
    if (existente) disponibles.delete(existente.numero);
    const mesaId = existente?.id ?? nuevoId('nueva');
    numeros[mesaId] = existente?.numero ?? (m.numero != null && !mesas.some((x) => x.numero === m.numero) ? m.numero : siguiente++);
    return { mesaId, forma, asientos, rot: Math.round(m.rot || 0), ...medidaMesa(forma, asientos), x: ajustar(sx(m.x)), y: ajustar(sy(m.y)) };
  });

  plano.elementos = analisis.elementos
    .filter((e) => e.tipo in ETIQUETA_ELEMENTO)
    .map((e) => ({ id: nuevoId('el'), tipo: e.tipo, x: ajustar(sx(e.x)), y: ajustar(sy(e.y)), w: Math.max(10, Math.round(sx(e.w))), h: Math.max(8, Math.round(sy(e.h))), rot: Math.round(e.rot || 0), etiqueta: e.etiqueta ?? undefined }));
  return { plano, numeros };
}
