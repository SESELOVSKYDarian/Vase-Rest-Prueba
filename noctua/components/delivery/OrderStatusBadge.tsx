import type { OrderStatus } from '@/types';
import { StatusChip } from '@/components/ui/StatusChip';
import { TONO_ESTADO_DELIVERY } from '@/hooks/lib/statusTones';

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

const LABEL_ESTADO_DELIVERY: Record<OrderStatus, string> = {
  new: 'Nuevo',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  ready: 'Listo',
  picked_up: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return <StatusChip tone={TONO_ESTADO_DELIVERY[status]} label={LABEL_ESTADO_DELIVERY[status]} />;
}
