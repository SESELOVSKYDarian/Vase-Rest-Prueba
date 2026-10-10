import type { EstadoMesa } from './mesa';

/** Qué tan urgente es mirar una mesa: ok no se marca; atención se avisa; urgente late en el plano. */
export type NivelAlerta = 'ok' | 'atencion' | 'urgente';

export interface SenalMesa {
  estadoMesa: EstadoMesa;
  /** Estado del pedido abierto de la mesa (pendiente, preparando, listo, entregado…). */
  estadoPedido?: string | null;
  /** Minutos que el pedido lleva en ese estado. */
  minEnEstado?: number | null;
  /** Minutos que la mesa lleva con gente. */
  minOcupada?: number | null;
}

export interface AlertaMesa { nivel: NivelAlerta; motivo: string }

/** Minutos a partir de los cuales una mesa merece atención / es urgente, según en qué espera. */
export const UMBRALES_ESPERA = {
  /** Cocina todavía no lo tomó. */
  pendiente: { atencion: 5, urgente: 10 },
  /** En preparación. */
  preparando: { atencion: 20, urgente: 35 },
  /** Listo en la barra, sin llevar a la mesa: lo que más se enfría. */
  listo: { atencion: 3, urgente: 6 },
  /** Pidieron la cuenta o está para cobrar. */
  cobrar: { atencion: 5, urgente: 10 },
  /** Sentados sin pedido cargado. */
  sinPedido: { atencion: 8, urgente: 15 },
  /** Mesa ocupada demasiado tiempo (rotación). */
  estadia: { atencion: 100, urgente: 150 },
} as const;

const ESTADOS_PREPARANDO = new Set(['preparando', 'en_preparacion']);
const ESTADOS_COBRAR = new Set(['lista_para_cobrar']);

const nivelPara = (min: number, u: { atencion: number; urgente: number }): NivelAlerta => (min >= u.urgente ? 'urgente' : min >= u.atencion ? 'atencion' : 'ok');
const peor = (a: AlertaMesa, b: AlertaMesa): AlertaMesa => ((['ok', 'atencion', 'urgente'] as const).indexOf(b.nivel) > (['ok', 'atencion', 'urgente'] as const).indexOf(a.nivel) ? b : a);

/** "hace 7 min" / "1 h 05 min": corto, para el motivo de la alerta. */
export const minutosLegibles = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`);

/** Evalúa una mesa y dice por qué hay que mirarla (o que está todo bien). */
export function alertaMesa(s: SenalMesa): AlertaMesa {
  const OK: AlertaMesa = { nivel: 'ok', motivo: '' };
  if (s.estadoMesa === 'libre' || s.estadoMesa === 'problema') return OK;
  const enEstado = Math.max(0, Math.round(s.minEnEstado ?? 0));
  const ocupada = Math.max(0, Math.round(s.minOcupada ?? 0));
  const candidatos: AlertaMesa[] = [OK];

  const ped = s.estadoPedido ?? null;
  if (!ped) {
    if (s.estadoMesa === 'ocupada') {
      const n = nivelPara(ocupada, UMBRALES_ESPERA.sinPedido);
      if (n !== 'ok') candidatos.push({ nivel: n, motivo: `Sentados hace ${minutosLegibles(ocupada)} sin pedido` });
    }
  } else if (ped === 'pendiente') {
    const n = nivelPara(enEstado, UMBRALES_ESPERA.pendiente);
    if (n !== 'ok') candidatos.push({ nivel: n, motivo: `Pedido sin tomar en cocina hace ${minutosLegibles(enEstado)}` });
  } else if (ESTADOS_PREPARANDO.has(ped)) {
    const n = nivelPara(enEstado, UMBRALES_ESPERA.preparando);
    if (n !== 'ok') candidatos.push({ nivel: n, motivo: `En preparación hace ${minutosLegibles(enEstado)}` });
  } else if (ped === 'listo') {
    const n = nivelPara(enEstado, UMBRALES_ESPERA.listo);
    if (n !== 'ok') candidatos.push({ nivel: n, motivo: `Listo hace ${minutosLegibles(enEstado)}, sin servir` });
  } else if (ESTADOS_COBRAR.has(ped) || s.estadoMesa === 'para_cobrar' || s.estadoMesa === 'esperando_pago') {
    const n = nivelPara(enEstado, UMBRALES_ESPERA.cobrar);
    if (n !== 'ok') candidatos.push({ nivel: n, motivo: `Esperando la cuenta hace ${minutosLegibles(enEstado)}` });
  }
  // Una mesa lista para cobrar sin pedido en ese estado también espera.
  if (s.estadoMesa === 'pedido_listo' && !ped) {
    const n = nivelPara(enEstado, UMBRALES_ESPERA.listo);
    if (n !== 'ok') candidatos.push({ nivel: n, motivo: `Listo hace ${minutosLegibles(enEstado)}, sin servir` });
  }
  const estadia = nivelPara(ocupada, UMBRALES_ESPERA.estadia);
  if (estadia !== 'ok') candidatos.push({ nivel: estadia, motivo: `Ocupada hace ${minutosLegibles(ocupada)}` });
  return candidatos.reduce(peor);
}

export interface CargaMozo {
  id: string;
  nombre: string;
  /** Mesas con gente que atiende ahora. */
  mesasActivas: number;
  /** Comensales sentados en esas mesas. */
  comensalesActivos: number;
  /** Mesas que se le dieron en las últimas horas del turno. */
  asignadasEnTurno: number;
  /** Cuándo se le dio la última mesa (ms epoch) o null. */
  ultimaAsignacion: number | null;
}

/**
 * Reparto justo: a quien tiene menos trabajo ahora (mesas y comensales abiertos), después a quien
 * recibió menos mesas en el turno, y a igualdad a quien hace más que no se le asigna una.
 */
export function ordenarPorCarga(mozos: readonly CargaMozo[]): CargaMozo[] {
  const peso = (m: CargaMozo) => m.mesasActivas * 3 + m.comensalesActivos;
  return [...mozos].sort(
    (a, b) => peso(a) - peso(b) || a.asignadasEnTurno - b.asignadasEnTurno || (a.ultimaAsignacion ?? 0) - (b.ultimaAsignacion ?? 0) || a.nombre.localeCompare(b.nombre, 'es'),
  );
}

export const sugerirMozo = (mozos: readonly CargaMozo[]): CargaMozo | null => ordenarPorCarga(mozos)[0] ?? null;

/** Iniciales para la insignia del plano: "Ana Pérez" → "AP", "Mozo" → "MO". */
export function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export type MetricaCalor = 'ventas' | 'rotacion' | 'permanencia';

export interface CalorMesa {
  mesaId: string;
  ventas: number;
  pedidos: number;
  /** Veces por día que la mesa se usó en el período. */
  rotacion: number;
  /** Minutos promedio que se queda la gente. */
  permanenciaMin: number | null;
}

/** Valor de la métrica para una mesa. */
export const valorCalor = (c: CalorMesa, metrica: MetricaCalor): number | null =>
  metrica === 'ventas' ? c.ventas : metrica === 'rotacion' ? c.rotacion : c.permanenciaMin;

/** Intensidad 0..1 de cada mesa respecto a la mejor (mesas sin dato quedan afuera). */
export function intensidadesCalor(calor: readonly CalorMesa[], metrica: MetricaCalor): Map<string, number> {
  const valores = calor.map((c) => [c.mesaId, valorCalor(c, metrica)] as const).filter((x): x is readonly [string, number] => x[1] != null && x[1] > 0);
  const max = Math.max(0, ...valores.map(([, v]) => v));
  return new Map(valores.map(([id, v]) => [id, max ? v / max : 0]));
}
