'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { formatARS } from '@/hooks/lib/utils';
import { obtenerPedidosPorFecha } from '@/hooks/lib/api/pedidosApi';
import type { Pedido } from '@/types/pedido';
import { TEXTO_ESTADO_COCINA } from '@/hooks/lib/constants';
import { cn } from '@/hooks/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';

export default function HistorialPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Default: hoy
  const hoy = new Date().toISOString().split('T')[0];
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);

  const cargarHistorial = async () => {
    setLoading(true);
    try {
      // Ajuste de rango para abarcar el día completo (UTC)
      const inicioStr = new Date(`${fechaInicio}T00:00:00.000Z`).toISOString();
      const finStr = new Date(`${fechaFin}T23:59:59.999Z`).toISOString();
      const data = await obtenerPedidosPorFecha(inicioStr, finStr);
      setPedidos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, []);

  const totalVendido = pedidos.reduce((acc, p) => acc + p.total, 0);

  return (
    <div className="space-y-6">
      {/* Header & Filtros */}
      <div className="bg-canvas border border-line rounded-xl p-5 flex flex-col md:flex-row gap-4 items-end justify-between">
        <div>
          <h2 className="text-ink text-lg font-medium">Historial de Pedidos</h2>
          <p className="text-ink-3 text-sm">Visualiza los pedidos despachados por fecha.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-3 uppercase font-semibold">Desde</label>
            <input 
              type="date" 
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="bg-surface-2 border border-line-strong rounded-md px-3 py-2 text-ink outline-none focus:border-brand text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink-3 uppercase font-semibold">Hasta</label>
            <input 
              type="date" 
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="bg-surface-2 border border-line-strong rounded-md px-3 py-2 text-ink outline-none focus:border-brand text-sm"
            />
          </div>
          <button 
            onClick={cargarHistorial}
            className="mb-0 mt-auto bg-brand text-on-brand px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-strong transition flex items-center gap-2"
          >
            <Search size={14} />
            Filtrar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-canvas border border-line rounded-xl p-5">
          <p className="text-xs text-ink-3 font-semibold tracking-widest uppercase mb-1">Total Pedidos</p>
          <p className="text-3xl text-ink font-semibold">{pedidos.length}</p>
        </div>
        <div className="bg-canvas border border-line rounded-xl p-5">
          <p className="text-xs text-ink-3 font-semibold tracking-widest uppercase mb-1">Ingresos Totales</p>
          <p className="text-3xl text-green-700 dark:text-green-400 font-semibold font-mono">{formatARS(totalVendido)}</p>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-canvas border border-line rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-ink-3">Cargando historial...</div>
        ) : pedidos.length === 0 ? (
          <EmptyState variant="search" title="Sin pedidos en estas fechas" hint="Ampliá el rango para ver más movimientos." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink-2">
              <thead className="bg-surface text-ink-3 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Mesa</th>
                  <th className="px-6 py-4">Detalle Items</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pedidos.map(p => (
                  <tr key={p.id} className="hover:bg-surface transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {p.creadoEn.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-ink font-bold">Mesa {p.numeroMesa}</span>
                      <br/>
                      <span className="text-xs text-ink-3">{p.zona}</span>
                    </td>
                    <td className="px-6 py-4 min-w-[250px]">
                      <div className="space-y-1">
                        {p.items.map(i => (
                          <div key={i.productoId} className="flex justify-between text-xs">
                            <span>{i.cantidad}x {i.nombre}</span>
                            <span className="text-ink-3">{formatARS(i.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full border",
                        p.estado === 'entregado' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30' :
                        p.estado === 'listo' ? 'bg-yellow-400/10 text-yellow-700 dark:text-yellow-400 border-yellow-400/30' :
                        'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                      )}>
                        {TEXTO_ESTADO_COCINA[p.estado]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-ink font-bold">
                      {formatARS(p.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
