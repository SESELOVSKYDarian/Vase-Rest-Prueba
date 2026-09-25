"use client";

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Grid, List } from 'lucide-react';
import { OrderCard } from '@/components/delivery/OrderCard';
import { useDeliveryOrders, useUpdateOrderStatus } from '@/hooks/useDeliveryOrders';
import { useDeliveryStore } from '@/store/deliveryStore';
import type { PlatformId } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';

const platformInfo: Record<PlatformId, { name: string; color: string }> = {
  pedidosya: { name: 'PedidosYa', color: '#FF0F50' },
  rappi: { name: 'Rappi', color: '#FF441F' },
  glovo: { name: 'Glovo', color: '#FFC244' },
  ubereats: { name: 'Uber Eats', color: '#06C167' }
};

export default function PlatformPage() {
  const params = useParams();
  const platform = params.platform as PlatformId;
  const router = useRouter();
  const { data: orders, isLoading } = useDeliveryOrders(platform);
  const { mutate: updateStatus } = useUpdateOrderStatus(platform);
  const { viewMode, setViewMode } = useDeliveryStore();

  const info = platformInfo[platform];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-canvas border border-line text-ink-3 hover:text-ink hover:border-line-strong transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-ink">{info.name}</h1>
            <p className="text-ink-3 text-sm">{orders?.length || 0} pedidos</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-canvas border border-line rounded-lg p-1">
          <button
            onClick={() => setViewMode(platform, 'kanban')}
            className={`p-2 rounded-md transition-colors ${viewMode[platform] === 'kanban' ? 'bg-brand text-on-brand' : 'text-ink-3 hover:text-ink'}`}
          >
            <Grid size={20} />
          </button>
          <button
            onClick={() => setViewMode(platform, 'list')}
            className={`p-2 rounded-md transition-colors ${viewMode[platform] === 'list' ? 'bg-brand text-on-brand' : 'text-ink-3 hover:text-ink'}`}
          >
            <List size={20} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders?.length === 0 ? (
            <EmptyState title="Sin pedidos por ahora" hint="Los pedidos de esta app aparecen acá en cuanto entran." />
          ) : viewMode[platform] === 'kanban' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders?.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatusChange={(id, status) => updateStatus({ orderId: id, status })}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {orders?.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatusChange={(id, status) => updateStatus({ orderId: id, status })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
