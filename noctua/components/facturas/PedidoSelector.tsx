'use client';

import { memo } from 'react';
import { Receipt } from 'lucide-react';
import type { PedidoFacturaItem, PedidoListoFactura } from '@/services/facturasService';
import { formatearARS } from './facturasConstants';
import { StatusChip } from '@/components/ui/StatusChip';
import { TONO_ESTADO_COCINA } from '@/hooks/lib/statusTones';
import type { EstadoCocina } from '@/types/pedido';
import { cn } from '@/hooks/lib/utils';

interface PedidoSelectorProps {
  pedidos: PedidoListoFactura[];
  pedidoSeleccionado: PedidoListoFactura | null;
  pedidoSeleccionadoId: string;
  onSeleccionarPedido: (pedidoId: string) => void;
}

function PedidoSelectorBase({
  pedidos,
  pedidoSeleccionado,
  pedidoSeleccionadoId,
  onSeleccionarPedido,
}: PedidoSelectorProps) {
  return (
    <section className="rounded-2xl border border-[#1a1a1a] bg-[#080808] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={18} className="text-[#676B67]" />
        <h2 className="font-black tracking-widest uppercase text-sm">Seleccionar pedido</h2>
      </div>

      {pedidos.length === 0 ? (
        <div className="rounded-xl border border-[#1a1a1a] bg-black/40 p-6 text-center">
          <p className="text-[#676B67] font-semibold">No hay pedidos listos para cobrar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Pedidos listos para cobrar">
            {pedidos.map((pedido) => {
              const seleccionado = pedido.id === pedidoSeleccionadoId;
              return (
                <button
                  key={pedido.id}
                  type="button"
                  role="radio"
                  aria-checked={seleccionado}
                  onClick={() => onSeleccionarPedido(pedido.id)}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors',
                    seleccionado ? 'border-white bg-white/5' : 'border-[#2a2a2a] bg-black hover:border-[#3a3a3a]'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black">Mesa {pedido.mesa?.numero || '-'}</span>
                    <span className="font-mono text-sm font-bold">{formatearARS(pedido.total)}</span>
                  </div>
                  <StatusChip tone={TONO_ESTADO_COCINA[pedido.estado as EstadoCocina] ?? 'info'} label={pedido.estado} />
                </button>
              );
            })}
          </div>

          {pedidoSeleccionado && (
            <div className="rounded-2xl border border-[#1a1a1a] bg-black/50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xl font-black">Mesa {pedidoSeleccionado.mesa?.numero || '-'}</h3>
                  <p className="text-xs text-[#676B67] uppercase tracking-widest">
                    {pedidoSeleccionado.mesa?.zona || 'Sin zona'} | {pedidoSeleccionado.estado}
                  </p>
                </div>
                <p className="text-2xl font-black font-mono">{formatearARS(pedidoSeleccionado.total)}</p>
              </div>

              <div className="space-y-2">
                {pedidoSeleccionado.items.map((item: PedidoFacturaItem) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 border-b border-[#111] pb-2">
                    <div>
                      <p className="text-sm font-bold">{item.cantidad} x {item.producto?.nombre || 'Producto'}</p>
                      {item.notas && <p className="text-xs text-yellow-400">{item.notas}</p>}
                    </div>
                    <p className="text-sm font-mono text-[#BCB9B9]">{formatearARS(item.subtotal)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export const PedidoSelector = memo(PedidoSelectorBase);
