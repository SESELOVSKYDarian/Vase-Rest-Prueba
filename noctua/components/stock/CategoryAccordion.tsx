'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { IngredientCard } from './IngredientCard';
import type { StockCategory, Ingredient } from '@/types/stock';

interface CategoryAccordionProps {
  category: StockCategory;
  filteredIngredients: Ingredient[];
}

export const CategoryAccordion = ({ category, filteredIngredients }: CategoryAccordionProps) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="bg-canvas border border-line rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface transition-colors"
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown size={18} className="text-ink-3" />
          ) : (
            <ChevronRight size={18} className="text-ink-3" />
          )}
          <span className="text-ink font-semibold text-sm">{category.name}</span>
          <span className="bg-surface-3 px-2 py-0.5 rounded-full text-xs text-ink-3">
            {filteredIngredients.length}
          </span>
        </div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-line"
          >
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredIngredients.map((ing, index) => (
                <IngredientCard key={ing.id} ingredient={ing} index={index} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
