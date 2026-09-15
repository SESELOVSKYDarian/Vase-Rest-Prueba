import type { EstadoMesa } from '@/types/mesa';
import type { EstadoCocina } from '@/types/pedido';
import type { OrderStatus } from '@/types';

/**
 * Semáforo de color único del sistema. Los 6 tonos base (success/warning/caution/danger/
 * info/special) son los pedidos por el rediseño de IA; `neutral` y `critical` se agregaron
 * al construir esto porque ya existían estados reales (mesa "problema", pedido de delivery
 * "delivered") que no encajan en ninguno de los 6 sin perder distinción visual real.
 */
export type StatusTone = 'success' | 'warning' | 'caution' | 'danger' | 'info' | 'special' | 'neutral' | 'critical';

export const TONO_ESTADO_MESA: Record<EstadoMesa, StatusTone> = {
  libre: 'success',
  ocupada: 'danger',
  esperando_pedido: 'info',
  pedido_listo: 'caution',
  esperando_pago: 'warning',
  para_cobrar: 'special',
  problema: 'critical',
};

export const TONO_ESTADO_COCINA: Record<EstadoCocina, StatusTone> = {
  pendiente: 'warning',
  preparando: 'caution',
  listo: 'success',
  entregado: 'neutral',
};

export const TONO_ESTADO_DELIVERY: Record<OrderStatus, StatusTone> = {
  new: 'warning',
  confirmed: 'info',
  preparing: 'caution',
  ready: 'success',
  picked_up: 'special',
  delivered: 'neutral',
  cancelled: 'danger',
};

export type TonoStock = 'agotado' | 'bajo' | 'ok';

export const TONO_ESTADO_STOCK: Record<TonoStock, StatusTone> = {
  agotado: 'danger',
  bajo: 'warning',
  ok: 'success',
};
