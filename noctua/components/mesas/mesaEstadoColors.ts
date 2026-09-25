/**
 * Colores de estado de mesa — tonos semánticos suavizados para que convivan con el lienzo
 * cálido del sistema (claro y oscuro). Para uso en SVG/canvas.
 * Debe coincidir exactamente con COLORES_ESTADO_MESA de hooks/lib/constants.ts.
 */
import type { EstadoMesa } from '@/types/mesa';

export const MESA_ESTADO_HEX: Record<EstadoMesa, string> = {
  libre:            '#3f9d6a',
  ocupada:          '#cf5a43',
  esperando_pedido: '#4b7fc4',
  pedido_listo:     '#df7f37',
  esperando_pago:   '#cfa12e',
  problema:         '#c24779',
  para_cobrar:      '#8a64c8',
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
