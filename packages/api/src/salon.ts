import { aCentavos, type CalorMesa, type CargaMozo, type Centavos } from '@vase/domain';
import { apiFetch } from './http';

/** Lo que el plano sabe de una mesa con gente además de su estado. */
export interface SenalApi {
  mesaId: string;
  pedidoId: string | null;
  pedidoEstado: string | null;
  minEnEstado: number | null;
  minOcupada: number | null;
  comensales: number | null;
  mozoId: string | null;
  mozoNombre: string | null;
}

export interface MozoCarga extends CargaMozo { mesas: string[] }

export interface EstadoSalon { mesas: SenalApi[]; mozos: MozoCarga[] }

export const obtenerEstadoSalon = () => apiFetch<EstadoSalon>('/inteligencia/salon');

export const asignarMozo = (mesaId: string, mozoId: string | null) =>
  apiFetch<{ ok: boolean }>('/inteligencia/asignar', { method: 'POST', body: JSON.stringify({ mesaId, mozoId }) });

export interface CalorSalon { dias: number; mesas: Array<CalorMesa & { ventasCentavos: Centavos }> }

export async function obtenerCalor(dias = 30): Promise<CalorSalon> {
  const r = await apiFetch<{ dias: number; mesas: CalorMesa[] }>(`/inteligencia/calor?dias=${dias}`);
  return { dias: r.dias, mesas: r.mesas.map((m) => ({ ...m, ventasCentavos: aCentavos(m.ventas) })) };
}
