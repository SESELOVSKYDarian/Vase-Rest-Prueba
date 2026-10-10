import { apiFetch } from './http';

/** Elegir mesa mirando el plano real: lo abre quien recibe el enlace del asistente de WhatsApp. */
export interface MesaParaReservar {
  id: string;
  numero: number;
  capacidad: number;
  zona: string | null;
  forma: string | null;
  posX: number;
  posY: number;
  libre: boolean;
  motivo: 'chica' | 'ocupada' | null;
}

export interface PlanoParaReservar {
  local: string;
  pedido: { fechaIso: string; hora: string; personas: number; cuando: string; nombre: string };
  duracionMin: number;
  plano: unknown;
  mesas: MesaParaReservar[];
}

export const obtenerPlanoParaReservar = (codigo: string) => apiFetch<PlanoParaReservar>(`/public/reservar?t=${encodeURIComponent(codigo)}`);

export const reservarDesdePlano = (codigo: string, mesaId: string, nombre: string) =>
  apiFetch<{ ok: boolean; mesa: number; estado: string }>('/public/reservar', { method: 'POST', body: JSON.stringify({ t: codigo, mesaId, nombre }) });

export interface ReservaPendiente {
  id: string;
  nombre: string;
  telefono: string;
  personas: number;
  inicio: string;
  mesa: number | null;
  origen: string;
  creadaEn: string;
}

export const confirmarReserva = (id: string) => apiFetch(`/avisos/reservas/${id}/confirmar`, { method: 'POST' });
export const rechazarReserva = (id: string, motivo: string) => apiFetch(`/avisos/reservas/${id}/rechazar`, { method: 'POST', body: JSON.stringify({ motivo }) });
