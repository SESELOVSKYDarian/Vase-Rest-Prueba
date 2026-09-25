'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Search, Maximize, Minimize, Pencil, Eye } from 'lucide-react';
import type { EstadoMesa, Mesa } from '@/types/mesa';

export type MesaFiltro = 'todas' | EstadoMesa;

const TABS: { key: MesaFiltro; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'libre', label: 'Libres' },
  { key: 'ocupada', label: 'Ocupadas' },
  { key: 'esperando_pedido', label: 'Esperando pedido' },
  { key: 'pedido_listo', label: 'Listas' },
  { key: 'para_cobrar', label: 'Para cobrar' },
];

interface MesasPageHeaderProps {
  mesas: Mesa[];
  search: string;
  onSearchChange: (value: string) => void;
  activeFilter: MesaFiltro;
  onFilterChange: (filter: MesaFiltro) => void;
  editorMode: 'edit' | 'preview';
  onToggleEditorMode: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

/** Encabezado propio de la página Mesas: título, buscador (⌘K), tabs de estado con contador y acciones de plano. */
export function MesasPageHeader({
  mesas,
  search,
  onSearchChange,
  activeFilter,
  onFilterChange,
  editorMode,
  onToggleEditorMode,
  isFullscreen,
  onToggleFullscreen,
}: MesasPageHeaderProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const counts = useMemo(() => {
    const base: Record<MesaFiltro, number> = {
      todas: mesas.length,
      libre: 0,
      ocupada: 0,
      esperando_pedido: 0,
      pedido_listo: 0,
      esperando_pago: 0,
      problema: 0,
      para_cobrar: 0,
    };
    mesas.forEach((mesa) => { base[mesa.estado] += 1; });
    return base;
  }, [mesas]);

  return (
    <div className="mb-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Mesas</h1>
          <p className="text-sm text-ink-3">Gestiona tu salón en tiempo real</p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
          <div className="relative flex h-11 w-72 min-w-0 flex-1 sm:flex-none max-w-full items-center rounded-full border border-line bg-surface-2 px-4 transition-colors focus-within:border-brand/50">
            <Search size={16} className="mr-2 flex-shrink-0 text-ink-3" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar mesa, zona o comensal..."
              className="w-full border-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
              aria-label="Buscar mesa, zona o comensal"
            />
            <kbd className="hidden flex-shrink-0 items-center gap-0.5 rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-[10px] text-ink-3 sm:inline-flex">⌘K</kbd>
          </div>

          <button
            type="button"
            onClick={onToggleEditorMode}
            aria-label={editorMode === 'edit' ? 'Salir de edición' : 'Editar plano'}
            className={`pressable flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
              editorMode === 'edit' ? 'bg-brand text-on-brand' : 'bg-surface-2 text-ink-2 hover:bg-surface-2'
            }`}
          >
            {editorMode === 'edit' ? <Eye size={15} /> : <Pencil size={15} />}
            <span className="hidden sm:inline">{editorMode === 'edit' ? 'Salir de edición' : 'Editar plano'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink-2 transition-colors hover:bg-surface-2"
          >
            {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onFilterChange(tab.key)}
              className={`flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
                active ? 'bg-brand text-on-brand' : 'bg-surface-2 text-ink-3 hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 text-xs font-semibold ${active ? 'bg-on-brand/20' : 'bg-ink/5'}`}>
                {counts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
