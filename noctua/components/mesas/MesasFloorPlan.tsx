'use client';

import { useState, useCallback, useRef, memo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { FabricFloorEditor } from './FabricFloorEditor';
import { MesaStatusLegend } from './MesaStatusLegend';
import { MesaContextMenu } from './MesaContextMenu';
import { MesaDetailPanel } from './MesaDetailPanel';
import { MesaMergeBar } from './MesaMergeBar';
import { useMesaMerge } from '@/hooks/useMesaMerge';
import { useMesaQuickSummary } from '@/hooks/useMesaQuickSummary';
import { mergeMesas, unmergeMesas } from '@/services/mesaMergeService';
import { setComensales } from '@/services/comensalesService';
import { useMesasStore } from '@/store/mesasStore';
import { toast } from '@/components/ui/Toast';
import { TEXTO_ESTADO_MESA } from '@/hooks/lib/constants';
import type { Mesa, EstadoMesa, ContextMenuAction } from '@/types/mesa';

/** Una mesa es elegible para unión si no forma parte ya de un grupo unido. */
function esElegibleParaUnir(mesa: Mesa): boolean {
  return !mesa.mesasUnidas || mesa.mesasUnidas.length === 0;
}

interface MesasFloorPlanProps {
  mesas:              Mesa[];
  mesasSeleccionadas: string[];
  onSingleClick:      (id: string) => void;
  onDoubleClick:      (mesa: Mesa) => void;
  onDelete:           (id: string) => void;
  onCreateMesa:       () => void;
  editorMode?:        'edit' | 'preview';
  onEditorModeChange?: (mode: 'edit' | 'preview') => void;
  visibleMesaIds?:    Set<string> | null;
}

interface ContextMenuState {
  mesa: Mesa;
  x:    number;
  y:    number;
}

/**
 * MesasFloorPlan — Contenedor principal del plano de planta.
 * Coordina el click sobre una mesa (panel de detalle), el menú contextual y la fusión de mesas.
 */
export const MesasFloorPlan = memo(function MesasFloorPlan({
  mesas,
  onSingleClick,
  onDoubleClick,
  onDelete,
  onCreateMesa,
  editorMode,
  onEditorModeChange,
  visibleMesaIds,
}: MesasFloorPlanProps) {
  // ── Estado de gestos ──────────────────────────────────────────────────────
  // `mesasSeleccionadas` (store) y el set de "mozo requerido" ya no tienen un
  // consumidor visual propio: MesasCanvasLayout (retirado) era el único que los
  // pintaba. La acción "llamar mozo" del menú contextual sigue siendo real
  // (dispara el toast), solo se perdió su indicador visual sobre la mesa.
  const [contextMenu, setContextMenu]   = useState<ContextMenuState | null>(null);
  const [, setMozo]                     = useState<Set<string>>(new Set());
  const [mergeLoading, setMergeLoading] = useState(false);
  const mozoTimers                      = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const cambiarEstadoMesa = useMesasStore((s) => s.cambiarEstadoMesa);
  const dividirMesas      = useMesasStore((s) => s.dividirMesas);
  const editarMesa        = useMesasStore((s) => s.editarMesa);

  const merge   = useMesaMerge();
  const summary = useMesaQuickSummary();

  // ── Gestos ────────────────────────────────────────────────────────────────

  const handleTap = useCallback((mesaId: string, _x: number, _y: number) => {
    // Modo selección de unión → agregar/quitar del grupo (solo mesas elegibles)
    if (merge.isSelectionMode) {
      const mesa = mesas.find((m) => m.id === mesaId);
      if (mesa && esElegibleParaUnir(mesa)) merge.toggleSelection(mesaId);
      return;
    }
    // Toggle panel de detalle: cerrar si ya está abierto para esa mesa
    if (summary.activeMesaId === mesaId) {
      summary.close();
    } else {
      summary.open(mesaId);
    }
    // Mantener compatibilidad con la lógica de selección desktop
    onSingleClick(mesaId);
  }, [merge, summary, mesas, onSingleClick]);

  // ── Acciones del menú contextual ─────────────────────────────────────────

  const handleContextAction = useCallback(async (
    action: ContextMenuAction,
    mesa: Mesa,
    nuevoEstado?: EstadoMesa
  ) => {
    setContextMenu(null);

    switch (action) {
      case 'abrir_pedido':
        onDoubleClick(mesa);
        break;

      case 'cambiar_estado':
        if (!nuevoEstado) break;
        try {
          await cambiarEstadoMesa(mesa.id, nuevoEstado);
          toast.success(`Mesa ${mesa.numero}`, `Estado: ${TEXTO_ESTADO_MESA[nuevoEstado]}`);
        } catch {
          toast.error('Error', 'No se pudo cambiar el estado');
        }
        break;

      case 'llamar_mozo': {
        // Limpiar timer anterior si existe
        const prevTimer = mozoTimers.current.get(mesa.id);
        if (prevTimer) clearTimeout(prevTimer);
        setMozo((prev) => new Set([...prev, mesa.id]));
        toast.info(`Mesa ${mesa.numero}`, 'Mozo requerido');
        // Auto-apagar tras 5 minutos
        const t = setTimeout(() => {
          setMozo((prev) => { const n = new Set(prev); n.delete(mesa.id); return n; });
          mozoTimers.current.delete(mesa.id);
        }, 5 * 60 * 1000);
        mozoTimers.current.set(mesa.id, t);
        break;
      }

      case 'marcar_cobrar':
        try {
          await cambiarEstadoMesa(mesa.id, 'para_cobrar');
          toast.info(`Mesa ${mesa.numero}`, 'Marcada para cobrar');
        } catch {
          toast.error('Error', 'No se pudo marcar la mesa');
        }
        break;

      case 'editar_comensales':
        // Abre la gestión de la mesa (modal) donde se editan los comensales
        onDoubleClick(mesa);
        break;

      case 'unir_mesa':
        // Desde el menú contextual: entrar en modo selección con esta mesa ya elegida
        merge.enterSelectionMode();
        merge.toggleSelection(mesa.id);
        break;

      case 'separar_mesa':
        dividirMesas(mesa.id);
        unmergeMesas(mesa.id).catch(console.error);
        toast.success('Mesas separadas', `Mesa ${mesa.numero} separada correctamente`);
        break;

      case 'cancelar':
        break;
    }
  }, [onDoubleClick, cambiarEstadoMesa, merge, dividirMesas]);

  // ── Fusión de mesas ───────────────────────────────────────────────────────

  const handleConfirmMerge = useCallback(async () => {
    if (merge.selectedIds.length < 2) return;
    setMergeLoading(true);
    // La primaria real la re-elige mesaMergeService por antigüedad del pedido;
    // acá alcanza con pasar la primera como origen y el resto como secundarias.
    const [origin, ...secondary] = merge.selectedIds;
    try {
      await mergeMesas(origin, secondary);
      toast.success('Mesas unidas correctamente', `Grupo de ${merge.selectedIds.length} mesas`);
      merge.exitSelectionMode();
    } catch {
      toast.error('Error al unir mesas', 'No se pudo completar la fusión');
    } finally {
      setMergeLoading(false);
    }
  }, [merge]);

  // ── Callbacks del panel de detalle ────────────────────────────────────────

  const handleSetComensales = useCallback(async (comensales: number) => {
    if (!summary.activeMesaId) return;
    try {
      await setComensales(summary.activeMesaId, comensales);
    } catch {
      toast.error('Error', 'No se pudieron actualizar los comensales');
    }
  }, [summary.activeMesaId]);

  // Números de mesas seleccionadas para mostrar en el MesaMergeBar
  const selectedNums = merge.selectedIds
    .map((id) => mesas.find((m) => m.id === id)?.numero ?? 0)
    .filter(Boolean);

  const activeMesa = mesas.find((m) => m.id === summary.activeMesaId) ?? null;

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${merge.isSelectionMode ? 'pb-28' : ''}`}>
      {/* Canvas del plano de planta */}
      <FabricFloorEditor mesas={mesas} onDelete={onDelete} onCreateMesa={onCreateMesa} onPreviewTableClick={handleTap} onSaveMesaPosition={(id, posicion) => useMesasStore.getState().moverMesa(id, posicion)} onUpdateMesaCapacity={(id, capacity) => { const mesa = mesas.find((item) => item.id === id); if (mesa) void editarMesa(id, { numero: mesa.numero, capacidad: capacity }); }} mode={editorMode} onModeChange={onEditorModeChange} visibleMesaIds={visibleMesaIds} />

      {/* Leyenda de estados */}
      <MesaStatusLegend mesas={mesas} />

      {/* Menú contextual (long press) */}
      <AnimatePresence>
        {contextMenu && (
          <MesaContextMenu
            key="context-menu"
            mesa={contextMenu.mesa}
            triggerX={contextMenu.x}
            triggerY={contextMenu.y}
            onAction={handleContextAction}
            onClose={() => setContextMenu(null)}
          />
        )}
      </AnimatePresence>

      {/* Panel de detalle (tap) */}
      <MesaDetailPanel
        mesa={activeMesa}
        data={summary.data}
        onClose={summary.close}
        onSetComensales={handleSetComensales}
        onMarcarParaCobrar={() => activeMesa && handleContextAction('marcar_cobrar', activeMesa)}
        onUnirMesas={() => activeMesa && handleContextAction('unir_mesa', activeMesa)}
        onMoreActions={(event) => activeMesa && setContextMenu({ mesa: activeMesa, x: event.clientX, y: event.clientY })}
      />

      {/* Barra de confirmación de unión (visible durante todo el modo selección) */}
      <AnimatePresence>
        {merge.isSelectionMode && (
          <MesaMergeBar
            key="merge-bar"
            selectedNums={selectedNums}
            maxReached={merge.maxReached}
            onConfirm={handleConfirmMerge}
            onCancel={merge.exitSelectionMode}
            isLoading={mergeLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
});
