"use client";

import { motion } from 'framer-motion';
import { OrderStatusBadge } from './OrderStatusBadge';
import type { Order } from '@/types';
import { formatARS } from '@/hooks/lib/utils';

interface OrderCardProps {
  order: Order;
  onStatusChange: (orderId: string, status: Order['status']) => void;
}

export function OrderCard({ order, onStatusChange }: OrderCardProps) {
  const orderAge = Date.now() - new Date(order.createdAt).getTime();
  const isUrgent = orderAge > 25 * 60 * 1000; // 25 minutes

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-canvas border border-line rounded-xl p-4 space-y-3"
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-ink font-semibold text-sm">{order.customer.name}</h4>
          <p className="text-ink-3 text-xs">{order.externalId}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {isUrgent && (
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-xs">
          <span className="animate-pulse">⚠️</span>
          Pedido urgente!
        </div>
      )}

      <div className="space-y-2">
        {order.items.map(item => (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <span className="text-ink">
              {item.quantity}x {item.dishName}
            </span>
            <span className="text-ink-2">{formatARS(item.quantity * item.price)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-line">
        <span className="text-lg font-bold text-ink">{formatARS(order.total)}</span>
        <div className="flex gap-2">
          {order.status === 'new' && (
            <button
              onClick={() => onStatusChange(order.id, 'confirmed')}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors"
            >
              Confirmar
            </button>
          )}
          {order.status === 'confirmed' && (
            <button
              onClick={() => onStatusChange(order.id, 'ready')}
              className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors"
            >
              Listo
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
