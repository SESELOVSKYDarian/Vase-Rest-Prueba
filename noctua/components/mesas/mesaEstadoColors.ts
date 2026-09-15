/**
 * Colores hex de estado de mesa — para uso en SVG y filtros de sombra.
 * Debe coincidir exactamente con COLORES_ESTADO_MESA de hooks/lib/constants.ts.
 */
import type { EstadoMesa } from '@/types/mesa';

export const MESA_ESTADO_HEX: Record<EstadoMesa, string> = {
  libre:            '#22c55e', // green-500
  ocupada:          '#ef4444', // red-500
  esperando_pedido: '#3b82f6', // blue-500
  pedido_listo:     '#f97316', // orange-500 — "Lista"
  esperando_pago:   '#facc15', // yellow-400
  problema:         '#db2777', // pink-600 (distinto de ocupada, que ya usa rojo)
  para_cobrar:      '#a855f7', // purple-500
};

/** Estados que implican personas sentadas (cambia color de sillas) */
export const ESTADOS_CON_PERSONAS: ReadonlySet<EstadoMesa> = new Set([
  'ocupada',
  'esperando_pedido',
  'pedido_listo',
  'esperando_pago',
]);

/** Determina la forma visual según capacidad (el tipo Mesa no tiene campo 'forma') */
export type FormaVisual = 'circular' | 'cuadrada' | 'rectangular';

export function getFormaVisual(capacidad: number): FormaVisual {
  if (capacidad <= 2) return 'circular';
  if (capacidad <= 4) return 'cuadrada';
  return 'rectangular';
}
