import type { Ingredient } from '@/types/stock';
import { StatusChip } from '@/components/ui/StatusChip';
import { TONO_ESTADO_STOCK, type TonoStock } from '@/hooks/lib/statusTones';

interface StockBadgeProps {
  ingredient: Ingredient;
}

const LABEL_ESTADO_STOCK: Record<TonoStock, string> = {
  agotado: 'Agotado',
  bajo: 'Bajo',
  ok: 'OK',
};

export const StockBadge = ({ ingredient }: StockBadgeProps) => {
  const estado: TonoStock = ingredient.stock === 0 ? 'agotado' : ingredient.stock < ingredient.minStock ? 'bajo' : 'ok';
  return <StatusChip tone={TONO_ESTADO_STOCK[estado]} label={LABEL_ESTADO_STOCK[estado]} />;
};
