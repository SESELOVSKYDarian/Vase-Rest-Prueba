'use client';

import { useEffect, useState, memo, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, Archive, CheckCircle, ChefHat, Play, Trash2, ArrowRight, MoreHorizontal, Settings } from 'lucide-react';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuthStore } from '@/store/authStore';
import { usePedidosStore } from '@/store/pedidosStore';
import { useMesasStore } from '@/store/mesasStore';
import { useSuperAdmStore } from '@/store/superadmStore';
import { cocinaService, SIGUIENTE_ESTADO_COCINA } from '@/services/cocinaService';
import { TONO_ESTADO_COCINA } from '@/hooks/lib/statusTones';
import { KDS_TIMER_GREEN_MINUTES, KDS_TIMER_YELLOW_MINUTES } from '@/hooks/lib/constants';
import { elapsedMinutes, formatElapsed, cn } from '@/hooks/lib/utils';
import type { Pedido, EstadoCocina } from '@/types/pedido';

// ── KDS Timer ──────────────────────────────────────────────────────────────────

function KDSTimer({ creadoEn }: { creadoEn: Date }) {
  const [elapsed, setElapsed] = useState('');
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const tick = () => {
      setElapsed(formatElapsed(creadoEn));
      setMinutes(elapsedMinutes(creadoEn));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [creadoEn]);

  const colorClass =
    minutes >= KDS_TIMER_YELLOW_MINUTES
      ? 'text-red-700 dark:text-red-400'
      : minutes >= KDS_TIMER_GREEN_MINUTES
      ? 'text-yellow-700 dark:text-yellow-400'
      : 'text-green-700 dark:text-green-400';

  return (
    <div className={cn('flex items-center gap-1.5 font-mono font-bold text-sm', colorClass,
      minutes >= KDS_TIMER_YELLOW_MINUTES && 'animate-pulse-red'
    )}>
      <Clock size={13} />
      {elapsed}
    </div>
  );
}

// ── KDS Card ──────────────────────────────────────────────────────────────────

const ICONOS_ESTADO: Record<string, any> = {
  pendiente: Play,
  preparando: ChefHat,
  listo: CheckCircle,
  entregado: Archive,
};

const ESTADOS_CANONICOS: EstadoCocina[] = ['pendiente', 'preparando', 'listo', 'entregado'];

const PedidoKDSCard = memo(function PedidoKDSCard({
  pedido,
  statuses,
  mesasLabel,
  onAvanzar,
  onCambiarEstado,
  onEliminar,
}: {
  pedido: Pedido;
  statuses: any[];
  mesasLabel: string;
  onAvanzar: (id: string) => void;
  onCambiarEstado: (id: string, nuevoEstado: string) => void;
  onEliminar: (id: string) => void;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const currentStatus = statuses.find(s => s.name.toLowerCase() === pedido.estado);
  const esTerminal = pedido.estado === 'entregado';
  const siguienteEstado = SIGUIENTE_ESTADO_COCINA[pedido.estado];
  const labelSiguiente = statuses.find((s) => s.name.toLowerCase() === siguienteEstado)?.name ?? siguienteEstado;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, transform: 'translateY(8px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transform: 'scale(0.97)', transition: { duration: 0.15 } }}
      transition={{ type: 'spring', duration: 0.35, bounce: 0.12 }}
      className="bg-surface border border-line rounded-xl p-4 space-y-3 shadow-soft border-l-[3px]"
      style={{ borderLeftColor: currentStatus?.bgColor ?? 'var(--line-strong)' }}
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-4xl font-semibold text-ink leading-none">
              {mesasLabel}
            </span>
            <div className="flex items-center gap-1 text-ink-3 text-xs mt-1">
              <Users size={11} />
              <span>{pedido.personas}</span>
            </div>
          </div>
          <p className="text-ink-3 text-xs mt-0.5 tracking-wide">{pedido.zona}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <KDSTimer creadoEn={pedido.creadoEn} />
          <div className="relative">
            <button
              onClick={() => setMenuAbierto((open) => !open)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 hover:bg-ink/5 hover:text-ink transition-colors"
              aria-label="Más acciones"
              aria-expanded={menuAbierto}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuAbierto && (
              <>
                <button className="fixed inset-0 z-10" aria-label="Cerrar menú" onClick={() => setMenuAbierto(false)} />
                <div className="absolute right-0 top-9 z-20 w-48 rounded-xl border border-line-strong bg-surface p-1.5 shadow-float">
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-3">Cambiar a</p>
                  {ESTADOS_CANONICOS.map((estado) => (
                    <button
                      key={estado}
                      onClick={() => { onCambiarEstado(pedido.id, estado); setMenuAbierto(false); }}
                      disabled={estado === pedido.estado}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-ink/5 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {statuses.find((s) => s.name.toLowerCase() === estado)?.name ?? estado}
                    </button>
                  ))}
                  <div className="my-1 h-px bg-surface-3" />
                  <button
                    onClick={() => { onEliminar(pedido.id); setMenuAbierto(false); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 dark:text-red-400 hover:bg-red-400/10"
                  >
                    <Trash2 size={14} />
                    Eliminar pedido
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1.5" role="list" aria-label="Items del pedido">
        {pedido.items.map((item, idx) => (
          <div key={`${item.productoId}-${idx}`} role="listitem" className="flex items-start gap-2">
            <span className="text-ink font-bold text-base leading-tight w-6 flex-shrink-0">
              {item.cantidad}×
            </span>
            <div>
              <p className="text-ink-2 text-sm font-medium leading-tight">{item.nombre}</p>
              {item.notas && (
                <p className="text-yellow-700 dark:text-yellow-400 text-xs mt-0.5 font-medium">
                  ⚑ {item.notas}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Estado + avanzar */}
      <div className="pt-2 border-t border-line space-y-2.5">
        <StatusChip tone={TONO_ESTADO_COCINA[pedido.estado]} label={currentStatus?.name ?? pedido.estado} />
        {!esTerminal && (
          <button
            onClick={() => onAvanzar(pedido.id)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand text-on-brand py-2.5 text-sm font-bold hover:bg-brand-strong transition-colors"
          >
            Avanzar a {labelSiguiente}
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    </motion.div>
  );
});

// ── KDS Column ────────────────────────────────────────────────────────────────

const KDSColumn = memo(function KDSColumn({
  status,
  allStatuses,
  pedidos,
  getMesasLabel,
  onAvanzar,
  onCambiarEstado,
  onEliminar,
}: {
  status: any;
  allStatuses: any[];
  pedidos: Pedido[];
  getMesasLabel: (pedido: Pedido) => string;
  onAvanzar: (id: string) => void;
  onCambiarEstado: (id: string, nuevoEstado: string) => void;
  onEliminar: (id: string) => void;
}) {
  return (
    <div className="flex flex-col bg-surface-2/60 border border-line rounded-2xl overflow-hidden">
      {/* El color configurado de la columna queda como punto + filete: identifica sin gritar. */}
      <div className="relative px-4 pt-4 pb-3 flex items-center justify-between">
        <span className="absolute inset-x-4 top-0 h-[3px] rounded-b-full" style={{ backgroundColor: status.bgColor }} aria-hidden="true" />
        <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.bgColor }} aria-hidden="true" />
          {status.name.charAt(0).toUpperCase() + status.name.slice(1).toLowerCase()}
        </span>
        <span className="tabular min-w-7 rounded-full bg-surface px-2 py-0.5 text-center text-xs font-medium text-ink-2 border border-line">{pedidos.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence mode="popLayout">
          {pedidos.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-32 text-ink-3 text-sm"
            >
              Sin pedidos
            </motion.div>
          ) : (
            pedidos.map((pedido) => (
              <PedidoKDSCard
                key={pedido.id}
                pedido={pedido}
                statuses={allStatuses}
                mesasLabel={getMesasLabel(pedido)}
                onAvanzar={onAvanzar}
                onCambiarEstado={onCambiarEstado}
                onEliminar={onEliminar}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

// ── Main Page ──────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 20_000; // 20 segundos

export default function CocinaPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const pedidos = usePedidosStore((s) => s.pedidos);
  const cargarPedidosActivos = usePedidosStore((s) => s.cargarPedidosActivos);
  const eliminarPedido = usePedidosStore((s) => s.eliminarPedido);
  const mesas = useMesasStore((s) => s.mesas);
  const cargarMesas = useMesasStore((s) => s.cargarMesas);
  const { config, initializeConfig } = useSuperAdmStore();
  const [pedidoAEliminar, setPedidoAEliminar] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Carga inicial + auto-refresh cada 20 s
  useEffect(() => {
    initializeConfig();
    cargarPedidosActivos();
    cargarMesas();

    const id = setInterval(() => {
      cargarPedidosActivos();
      cargarMesas();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [cargarPedidosActivos, cargarMesas, initializeConfig]);

  const handleRefreshManual = useCallback(async () => {
    setRefreshing(true);
    await cargarPedidosActivos();
    setRefreshing(false);
  }, [cargarPedidosActivos]);

  const handleCambiarEstado = useCallback(async (pedidoId: string, nuevoEstado: string) => {
    await cocinaService.cambiarEstadoLibre(pedidoId, nuevoEstado as any);
    // Refrescar pedidos (mover card de columna) y mesas (sincronizar estado)
    cargarPedidosActivos();
    cargarMesas();
  }, [cargarPedidosActivos, cargarMesas]);

  const handleAvanzar = useCallback(async (pedidoId: string) => {
    await cocinaService.avanzarEstado(pedidoId);
    cargarPedidosActivos();
    cargarMesas();
  }, [cargarPedidosActivos, cargarMesas]);

  const handleEliminar = useCallback((pedidoId: string) => {
    setPedidoAEliminar(pedidoId);
  }, []);

  const confirmarEliminar = useCallback(async () => {
    if (!pedidoAEliminar) return;
    try {
      await eliminarPedido(pedidoAEliminar);
    } catch {
      // store already logs the error
    }
    setPedidoAEliminar(null);
  }, [pedidoAEliminar, eliminarPedido]);

  // Memo para que KDSColumn no rompa su cache por nueva referencia
  const sortedStatuses = useMemo(
    () => [...config.kitchenStatuses].sort((a, b) => a.order - b.order),
    [config.kitchenStatuses]
  );

  // Solo pedidos activos en la KDS (entregado/cancelado ya no llegan por la API)
  const getPedidosPorEstado = useCallback(
    (estadoName: string) => pedidos.filter((p) => p.estado === estadoName.toLowerCase()),
    [pedidos]
  );

  // Etiqueta de mesa: "3" o "3+5" si tiene mesas unidas
  const getMesasLabel = useCallback((pedido: Pedido): string => {
    const mesa = mesas.find((m) => m.id === pedido.mesaId);
    if (!mesa?.mesasUnidas || mesa.mesasUnidas.length === 0) return String(pedido.numeroMesa);
    const otrosNums = mesa.mesasUnidas
      .map((id) => mesas.find((m) => m.id === id)?.numero ?? 0)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    return [mesa.numero, ...otrosNums].join('+');
  }, [mesas]);

  return (
    <div className="min-h-[calc(100dvh-10rem)] flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3 flex-shrink-0">
        <div>
          <h1>Cocina</h1>
          <p className="mt-1.5 text-sm text-ink-3">
            <span className="tabular">{pedidos.length}</span> {pedidos.length === 1 ? 'comanda activa' : 'comandas activas'} · se actualiza sola
          </p>
        </div>
        <div className="flex items-center gap-2">
          {usuario?.rol === 'admin' && (
            <Link
              href="/dashboard/cocina/configuracion"
              aria-label="Configurar estados de cocina"
              title="Configurar estados de cocina"
              className="pressable grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-ink-2 shadow-soft hover:border-line-strong hover:text-ink"
            >
              <Settings size={16} />
            </Link>
          )}
          <button
            onClick={handleRefreshManual}
            disabled={refreshing}
            className="pressable flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm text-ink-2 shadow-soft hover:border-line-strong hover:text-ink disabled:opacity-50"
          >
            <Clock size={15} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {sortedStatuses.map((status) => (
          <KDSColumn
            key={status.id}
            status={status}
            allStatuses={sortedStatuses}
            pedidos={getPedidosPorEstado(status.name)}
            getMesasLabel={getMesasLabel}
            onAvanzar={handleAvanzar}
            onCambiarEstado={handleCambiarEstado}
            onEliminar={handleEliminar}
          />
        ))}
      </div>

      <ConfirmDialog
        isOpen={Boolean(pedidoAEliminar)}
        onClose={() => setPedidoAEliminar(null)}
        onConfirm={confirmarEliminar}
        title="Eliminar pedido"
        message="Esta acción no se puede deshacer."
      />
    </div>
  );
}
