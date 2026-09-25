'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowRight, LayoutGrid, UtensilsCrossed, ClipboardList, Utensils, CalendarDays, Contact } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useMesasStore } from '@/store/mesasStore';
import { usePedidosStore } from '@/store/pedidosStore';
import { useProductosCatalog } from '@/hooks/useProductosCatalog';
import { useReservasIndex } from '@/hooks/useReservasIndex';
import { useCommandPaletteStore } from '@/store/commandPaletteStore';
import { clientesService } from '@/services/clientesService';
import { LABEL_POR_SECCION, RUTA_POR_SECCION, obtenerSeccionesPorRol } from '@/config/roles';

// Búsqueda insensible a mayúsculas y a tildes/diacríticos — con nombres reales en
// español (clientes, reservas), buscar "lucia" debe encontrar "Lucía" igual.
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface PaletteResult {
  id: string;
  group: string;
  icon: typeof LayoutGrid;
  label: string;
  sublabel?: string;
  href: string;
}

export function CommandPalette() {
  const isOpen = useCommandPaletteStore((s) => s.isOpen);
  const initialQuery = useCommandPaletteStore((s) => s.initialQuery);
  const instanceId = useCommandPaletteStore((s) => s.instanceId);
  const open = useCommandPaletteStore((s) => s.open);
  const close = useCommandPaletteStore((s) => s.close);

  // Atajo global ⌘K / Ctrl+K, activo en cualquier pantalla del dashboard.
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [open]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-scrim backdrop-blur-sm z-[200]"
            onClick={close}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-[201] flex items-start justify-center pt-[12vh] p-4" role="dialog" aria-modal="true" aria-label="Búsqueda global">
            <PaletteContent key={instanceId} initialQuery={initialQuery} onClose={close} />
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function PaletteContent({ initialQuery, onClose }: { initialQuery: string; onClose: () => void }) {
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const mesas = useMesasStore((s) => s.mesas);
  const cargarMesas = useMesasStore((s) => s.cargarMesas);
  const pedidos = usePedidosStore((s) => s.pedidos);
  const cargarPedidosActivos = usePedidosStore((s) => s.cargarPedidosActivos);
  const { productos } = useProductosCatalog();
  const { reservas } = useReservasIndex();
  const clientesQuery = useQuery({ queryKey: ['clientes'], queryFn: clientesService.getClientes });
  const clientes = clientesQuery.data ?? [];

  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cargarMesas();
    cargarPedidosActivos();
    inputRef.current?.focus();
  }, [cargarMesas, cargarPedidosActivos]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [onClose]);

  const allResults = useMemo<PaletteResult[]>(() => {
    const secciones = obtenerSeccionesPorRol(usuario?.rol).map((seccion) => ({
      id: `seccion-${seccion}`,
      group: 'Secciones',
      icon: LayoutGrid,
      label: LABEL_POR_SECCION[seccion],
      href: RUTA_POR_SECCION[seccion],
    }));

    const mesasResultados = mesas.map((mesa) => ({
      id: `mesa-${mesa.id}`,
      group: 'Mesas',
      icon: UtensilsCrossed,
      label: `Mesa ${mesa.numero}`,
      sublabel: mesa.zona,
      href: '/dashboard/mesas',
    }));

    const pedidosResultados = pedidos.map((pedido) => ({
      id: `pedido-${pedido.id}`,
      group: 'Pedidos',
      icon: ClipboardList,
      label: `Pedido — Mesa ${pedido.numeroMesa}`,
      sublabel: pedido.zona,
      href: `/dashboard/pedido?mesa=${pedido.mesaId}`,
    }));

    const platosResultados = productos.map((producto) => ({
      id: `plato-${producto.id}`,
      group: 'Platos',
      icon: Utensils,
      label: producto.nombre,
      sublabel: producto.categoria?.nombre,
      href: '/dashboard/platos',
    }));

    const reservasResultados = reservas.map((reserva) => ({
      id: `reserva-${reserva.id}`,
      group: 'Reservas',
      icon: CalendarDays,
      label: reserva.nombre_cliente,
      sublabel: `${reserva.fecha} ${reserva.hora}`.trim(),
      href: '/dashboard/reservas',
    }));

    const clientesResultados = clientes.map((cliente) => ({
      id: `cliente-${cliente.id}`,
      group: 'Clientes',
      icon: Contact,
      label: cliente.nombre,
      sublabel: cliente.telefono || cliente.email || undefined,
      href: '/dashboard/clientes',
    }));

    return [...secciones, ...mesasResultados, ...pedidosResultados, ...platosResultados, ...reservasResultados, ...clientesResultados];
  }, [usuario?.rol, mesas, pedidos, productos, reservas, clientes]);

  const filteredResults = useMemo(() => {
    const trimmed = normalizar(query);
    if (!trimmed) return allResults.filter((r) => r.group === 'Secciones');
    return allResults.filter((r) =>
      normalizar(r.label).includes(trimmed) || (r.sublabel && normalizar(r.sublabel).includes(trimmed))
    ).slice(0, 30);
  }, [allResults, query]);

  const groupedResults = useMemo(() => {
    const groups = new Map<string, PaletteResult[]>();
    filteredResults.forEach((result) => {
      const list = groups.get(result.group) ?? [];
      list.push(result);
      groups.set(result.group, list);
    });
    return Array.from(groups.entries());
  }, [filteredResults]);

  const navigateTo = (result: PaletteResult) => {
    router.push(result.href);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filteredResults.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const result = filteredResults[activeIndex];
      if (result) navigateTo(result);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -12 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="relative w-full max-w-xl bg-surface border border-line rounded-2xl shadow-float overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
        <Search size={18} className="text-ink-3 flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar secciones, mesas, pedidos, platos, reservas o clientes..."
          className="flex-1 bg-transparent border-0 outline-none text-ink placeholder:text-ink-3 text-sm"
          aria-label="Buscar en Vase Rest"
        />
        <kbd className="hidden sm:inline text-[10px] text-ink-3 border border-line-strong rounded px-1.5 py-0.5">Esc</kbd>
      </div>

      <div className="max-h-[60vh] overflow-y-auto p-2">
        {filteredResults.length === 0 ? (
          <p className="text-center text-ink-3 text-sm py-8">No se encontraron resultados</p>
        ) : (
          groupedResults.map(([group, results]) => (
            <div key={group} className="mb-2 last:mb-0">
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-ink-3 font-semibold">{group}</p>
              {results.map((result) => {
                const globalIndex = filteredResults.indexOf(result);
                const isActive = globalIndex === activeIndex;
                const Icon = result.icon;
                return (
                  <button
                    key={result.id}
                    onMouseEnter={() => setActiveIndex(globalIndex)}
                    onClick={() => navigateTo(result)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                      isActive ? 'bg-brand/10 text-brand-strong' : 'text-ink-2 hover:bg-surface-3'
                    }`}
                  >
                    <Icon size={16} className="flex-shrink-0 opacity-70" />
                    <span className="flex-1 min-w-0 truncate">{result.label}</span>
                    {result.sublabel && <span className="text-xs text-ink-3 flex-shrink-0 truncate max-w-[35%]">{result.sublabel}</span>}
                    <ArrowRight size={14} className="flex-shrink-0 opacity-50" />
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
