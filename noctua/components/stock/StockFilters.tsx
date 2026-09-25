'use client';

import { Search, Grid, List } from 'lucide-react';
import { useStockStore } from "@/store/stockStore";
import type { StockCategory } from "@/types/stock";
import { cn } from "@/hooks/lib/utils";

interface StockFiltersProps {
  categories: StockCategory[];
}

export const StockFilters = ({ categories }: StockFiltersProps) => {
  const {
    filter,
    setFilter,
    view,
    setView,
    searchQuery,
    setSearch,
    selectedCategory,
    setSelectedCategory,
  } = useStockStore();

  return (
    <div className="space-y-4">
      {/* Search and view toggle */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" size={18} />
          <input
            type="text"
            placeholder="Buscar ingrediente..."
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-canvas border border-line rounded-xl text-ink placeholder-ink-3 focus:outline-none focus:border-line-strong transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-canvas border border-line rounded-xl">
          <button
            onClick={() => setView('grid')}
            className={cn(
              "p-2 rounded-lg transition-colors",
              view === 'grid' ? 'bg-brand text-on-brand' : 'text-ink-3 hover:text-ink'
            )}
          >
            <Grid size={18} />
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              "p-2 rounded-lg transition-colors",
              view === 'list' ? 'bg-brand text-on-brand' : 'text-ink-3 hover:text-ink'
            )}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            "px-4 py-2 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap transition-colors",
            selectedCategory === null
              ? "bg-brand text-on-brand"
              : "bg-surface-3 text-ink-2 hover:bg-surface-3"
          )}
        >
          Todas las categorías
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap transition-colors",
              selectedCategory === cat.id
                ? "bg-brand text-on-brand"
                : "bg-surface-3 text-ink-2 hover:bg-surface-3"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* State filters */}
      <div className="flex items-center gap-2">
        {[
          { key: 'all' as const, label: 'Todos' },
          { key: 'low' as const, label: 'Bajo' },
          { key: 'ok' as const, label: 'OK' },
          { key: 'empty' as const, label: 'Sin stock' },
          { key: 'expiring' as const, label: 'Por vencer' },
        ].map((state) => (
          <button
            key={state.key}
            onClick={() => setFilter(state.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-colors",
              filter === state.key
                ? "bg-surface-3 text-ink border border-line-strong"
                : "text-ink-3 hover:text-ink"
            )}
          >
            {state.label}
          </button>
        ))}
      </div>
    </div>
  );
};
