'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, Clock, Users, DollarSign, MoreHorizontal, ShoppingBag, ClipboardList, MessageSquare } from 'lucide-react';
import { TEXTO_ESTADO_MESA, COLORES_ESTADO_MESA, COMENSALES_MIN, COMENSALES_MAX_ABSOLUTO } from '@/hooks/lib/constants';
import { formatARS } from '@/hooks/lib/utils';
import { useNowTick, formatElapsedShort } from '@/hooks/useMesaTimer';
import { useMozosStore } from '@/store/mozosStore';
import { usePedidosStore } from '@/store/pedidosStore';
import { setComensales } from '@/services/comensalesService';
import { toast } from '@/components/ui/Toast';
import type { Mesa, MesaQuickSummaryData } from '@/types/mesa';
import type { NombreZona } from '@/types/mozos';

/** Las zonas de mesas y las zonas de turnos de mozos usan vocabularios distintos hoy;
 *  este es un mapeo honesto por palabra clave, no una tabla real — si no hay coincidencia
 *  clara, no se muestra un mozo inventado. */
function zonaMesaToNombreZona(zona: string): NombreZona | null {
  const normalizado = zona.toLocaleLowerCase();
  if (normalizado.includes('terraza')) return 'Zona Terraza';
  if (normalizado.includes('principal')) return 'Zona Principal';
  if (normalizado.includes('cava')) return 'Zona Cava';
  if (normalizado.includes('privada')) return 'Zona Privada';
  return null;
}

type Tab = 'pedido' | 'comensales' | 'notas';

interface MesaDetailPanelProps {
  mesa: Mesa | null;
  data: MesaQuickSummaryData | null;
  onClose: () => void;
  onSetComensales: (comensales: number) => void;
  onMarcarParaCobrar: () => void;
  onUnirMesas: () => void;
  onMoreActions: (event: React.MouseEvent) => void;
}

export function MesaDetailPanel({ mesa, data, onClose, onSetComensales, onMarcarParaCobrar, onUnirMesas, onMoreActions }: MesaDetailPanelProps) {
  const router = useRouter();
  const iniciarPedido = usePedidosStore((s) => s.iniciarPedido);
  const getMozoAsignadoPorZona = useMozosStore((s) => s.getMozoAsignadoPorZona);
  const [tab, setTab] = useState<Tab>('pedido');
  const now = useNowTick();

  const nombreZona = mesa ? zonaMesaToNombreZona(mesa.zona) : null;
  const mozoDeTurno = useMemo(() => (nombreZona ? getMozoAsignadoPorZona(nombreZona) : null), [nombreZona, getMozoAsignadoPorZona]);

  const codigo = mesa ? `M${String(mesa.numero).padStart(2, '0')}` : '';
  const elapsed = data?.timerInicio ? formatElapsedShort(data.timerInicio, now) : null;
  const comensales = data?.comensales ?? 0;

  const handleAbrirPedido = () => {
    if (!mesa) return;
    setComensales(mesa.id, comensales || mesa.capacidad).catch(() => {});
    iniciarPedido(mesa.id, mesa.numero, mesa.zona, comensales || mesa.capacidad);
    router.push(`/dashboard/pedido?mesa=${mesa.id}`);
    onClose();
  };

  const handleCopiarLink = async () => {
    if (!mesa) return;
    const url = `${window.location.origin}${window.location.pathname}?mesa=${mesa.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Mesa ${mesa.numero}`, 'Link copiado al portapapeles');
    } catch {
      toast.error('Error', 'No se pudo copiar el link');
    }
  };

  const notas = (data?.items ?? [])
    .map((item) => ('notas' in item ? (item as { notas?: string }).notas : undefined))
    .filter((n): n is string => Boolean(n && n.trim()));

  const setComensalesClamped = (next: number) => {
    onSetComensales(Math.max(COMENSALES_MIN, Math.min(COMENSALES_MAX_ABSOLUTO, next)));
  };

  return (
    <AnimatePresence>
      {mesa && data && (
      <motion.aside
        key={mesa.id}
        initial={{ x: 380, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 380, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className="absolute right-0 top-0 z-40 flex h-full w-[380px] max-w-full flex-col border-l border-line bg-surface/98 shadow-float backdrop-blur-xl"
      >
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink">Mesa {mesa.numero}</h2>
              <button onClick={handleCopiarLink} aria-label="Copiar link de la mesa" className="text-ink-3 transition-colors hover:text-ink">
                <Link2 size={15} />
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-3">{mesa.zona} · {comensales} comensales</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${COLORES_ESTADO_MESA[mesa.estado]}`}>
              {TEXTO_ESTADO_MESA[mesa.estado]}
            </span>
            <button onClick={onClose} aria-label="Cerrar panel" className="text-ink-3 transition-colors hover:text-ink">
              <X size={18} />
            </button>
          </div>
        </div>

        {elapsed && (
          <div className="flex items-center gap-1.5 border-b border-line px-5 py-2 text-xs text-ink-3">
            <Clock size={12} />
            <span>Desde hace {elapsed}</span>
          </div>
        )}

        {/* Tarjetas info */}
        <div className="grid grid-cols-3 gap-2 px-5 py-4">
          <div className="rounded-xl border border-line bg-surface p-2.5">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-3"><Users size={11} /> Comensales</p>
            <p className="mt-1 text-sm font-semibold text-ink">{comensales}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-ink-3">
              {data.mozoNombre ? 'Atendiendo' : 'Mozo de turno'}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-ink">
              {data.mozoNombre || (mozoDeTurno ? `${mozoDeTurno.nombre} ${mozoDeTurno.apellido}` : 'Sin asignar')}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-ink-3">Código</p>
            <p className="mt-1 text-sm font-semibold text-ink">{codigo}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5">
          {([
            { key: 'pedido', label: 'Pedido', icon: ShoppingBag },
            { key: 'comensales', label: 'Comensales', icon: ClipboardList },
            { key: 'notas', label: 'Notas', icon: MessageSquare },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === key ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto border-t border-line px-5 py-4">
          {tab === 'pedido' && (
            data.items.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-ink-3">
                  <span className="uppercase tracking-wider">{data.items.length} platos</span>
                  <span className="font-mono text-ink">{formatARS(data.total)}</span>
                </div>
                <div className="space-y-2">
                  {data.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-ink-2"><span className="text-ink-3">{item.cantidad}</span> {item.nombre}</span>
                      <span className="font-mono text-ink">{formatARS(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-ink-3">Sin pedido activo</p>
            )
          )}

          {tab === 'comensales' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-xs uppercase tracking-wider text-ink-3">Comensales sentados</p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setComensalesClamped(comensales - 1)}
                  disabled={comensales <= COMENSALES_MIN}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-strong bg-surface text-xl font-bold text-ink transition-colors hover:bg-surface-3 disabled:opacity-30"
                >−</button>
                <span className="w-10 text-center text-2xl font-bold text-ink">{comensales}</span>
                <button
                  onClick={() => setComensalesClamped(comensales + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-strong bg-surface text-xl font-bold text-ink transition-colors hover:bg-surface-3"
                >+</button>
              </div>
              {comensales > mesa.capacidad && (
                <p className="text-center text-xs text-amber-700 dark:text-amber-400">Supera la capacidad de la mesa ({mesa.capacidad}).</p>
              )}
            </div>
          )}

          {tab === 'notas' && (
            notas.length > 0 ? (
              <ul className="space-y-2">
                {notas.map((nota, index) => (
                  <li key={index} className="rounded-lg border border-line bg-surface p-2.5 text-sm text-ink-2">{nota}</li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-ink-3">Sin notas en los ítems del pedido</p>
            )
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
          <button
            onClick={handleAbrirPedido}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand"
          >
            <ShoppingBag size={15} />
            {data.items.length > 0 ? 'Ver pedido' : 'Abrir pedido'}
          </button>
          <button
            onClick={onMarcarParaCobrar}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-medium text-ink-2 transition-colors hover:bg-ink/5"
          >
            <DollarSign size={15} />
            Marcar para cobrar
          </button>
          <button
            onClick={onUnirMesas}
            className="flex h-11 items-center justify-center rounded-xl border border-line-strong px-4 text-sm font-medium text-ink-2 transition-colors hover:bg-ink/5"
          >
            Unir mesas
          </button>
          <button
            onClick={onMoreActions}
            aria-label="Más acciones"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong text-ink-2 transition-colors hover:bg-ink/5"
          >
            <MoreHorizontal size={17} />
          </button>
        </div>
      </motion.aside>
      )}
    </AnimatePresence>
  );
}
