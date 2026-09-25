'use client';

import { motion } from 'framer-motion';
import { Plus, Package } from 'lucide-react';
import { useStockStore } from '@/store/stockStore';

interface StockHeaderProps {
  onOpenModal: () => void;
}

export const StockHeader = ({ onOpenModal }: StockHeaderProps) => {
  const categories = useStockStore((s) => s.categories);
  
  // Compute values from state instead of calling store functions
  const totalIngredients = categories.reduce((total, cat) => total + cat.ingredients.length, 0);
  const lowStockIngredients = categories.flatMap(cat => cat.ingredients).filter(ing => ing.stock < ing.minStock);

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Package size={24} className="text-ink" />
          <h2 className="text-lg font-medium text-ink">Ingredientes y productos</h2>
        </div>
        <p className="text-ink-3 text-sm">
          Gestiona tu inventario de ingredientes y productos
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <p className="text-2xl font-bold text-ink">{totalIngredients}</p>
            <p className="text-ink-3 text-xs">Productos totales</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{lowStockIngredients.length}</p>
            <p className="text-ink-3 text-xs">Bajo stock</p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onOpenModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand text-on-brand rounded-xl text-sm font-bold hover:bg-brand-strong transition-colors"
        >
          <Plus size={18} />
          Añadir producto
        </motion.button>
      </div>
    </div>
  );
};
