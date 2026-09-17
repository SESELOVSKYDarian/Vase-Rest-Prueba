'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Plato } from '@/types/platos';

interface DishSelectorProps {
  platos: Plato[];
  selectedDishIds: string[];
  onChange: (dishIds: string[]) => void;
  discountPercentage: number;
}

export function DishSelector({ platos, selectedDishIds, onChange, discountPercentage }: DishSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categorias = useMemo(() => {
    const nombres = new Set(platos.map((plato) => plato.categoriaNombre));
    return Array.from(nombres);
  }, [platos]);

  const filteredDishes = useMemo(() => {
    return platos.filter((plato) => {
      const matchesSearch = plato.nombre.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || plato.categoriaNombre === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [platos, searchQuery, selectedCategory]);

  const handleToggleDish = (dishId: string) => {
    if (selectedDishIds.includes(dishId)) {
      onChange(selectedDishIds.filter((id) => id !== dishId));
    } else {
      onChange([...selectedDishIds, dishId]);
    }
  };

  const handleSelectAllInCategory = () => {
    const categoryDishIds = filteredDishes.map((d) => d.id);
    const allSelected = categoryDishIds.every((id) => selectedDishIds.includes(id));

    if (allSelected) {
      onChange(selectedDishIds.filter((id) => !categoryDishIds.includes(id)));
    } else {
      const newSelected = new Set([...selectedDishIds, ...categoryDishIds]);
      onChange(Array.from(newSelected));
    }
  };

  const calculateDiscountedPrice = (price: number) => {
    return price - (price * discountPercentage) / 100;
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#676b67]" size={16} />
          <input
            type="text"
            placeholder="Buscar plato..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg pl-10 pr-4 py-2 text-sm text-white"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="all">Todas</option>
          {categorias.map((nombre) => (
            <option key={nombre} value={nombre}>{nombre}</option>
          ))}
        </select>
      </div>

      {filteredDishes.length > 0 && (
        <button
          type="button"
          onClick={handleSelectAllInCategory}
          className="text-xs text-violet-400 hover:text-violet-300"
        >
          {filteredDishes.every((d) => selectedDishIds.includes(d.id))
            ? 'Deseleccionar todos en la categoría'
            : 'Seleccionar todos en la categoría'}
        </button>
      )}

      <div className="max-h-48 overflow-y-auto space-y-2 bg-[#0a0a0a] rounded-lg p-2 border border-[#2a2a2a]">
        {filteredDishes.length === 0 && (
          <p className="text-center text-[#676b67] text-sm py-4">No hay platos para mostrar</p>
        )}
        {filteredDishes.map((plato) => (
          <label
            key={plato.id}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-[#151515] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedDishIds.includes(plato.id)}
                onChange={() => handleToggleDish(plato.id)}
                className="rounded"
              />
              <div>
                <div className="text-white text-sm">{plato.nombre}</div>
                <div className="text-[#676b67] text-xs">{plato.categoriaNombre}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#676b67] text-sm line-through">${plato.precio.toFixed(2)}</span>
              <span className="text-green-400 text-sm font-medium">
                ${calculateDiscountedPrice(plato.precio).toFixed(2)}
              </span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
