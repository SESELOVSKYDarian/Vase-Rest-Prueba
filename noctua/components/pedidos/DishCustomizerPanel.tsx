'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, XCircle } from 'lucide-react';
import { generateCustomizationOptions } from '@/lib/customizationGenerator';
import type { Dish, DishCustomizationOption, SelectedCustomization, RecipeIngredient } from '@/types/dishes';
import type { Ingredient } from '@/types/stock';

interface DishCustomizerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  dish: Dish;
  allIngredients: Ingredient[];
  onAddToOrder: (data: {
    dish: Dish;
    quantity: number;
    notes: string;
    selectedCustomizations: SelectedCustomization[];
  }) => void;
  initialData?: {
    quantity: number;
    notes: string;
    selectedCustomizations: SelectedCustomization[];
  };
}

export function DishCustomizerPanel({ 
  isOpen, 
  onClose, 
  dish, 
  allIngredients, 
  onAddToOrder, 
  initialData 
}: DishCustomizerPanelProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [cookingPreference, setCookingPreference] = useState<string>('');

  const customizationOptions = useMemo(() => {
    return generateCustomizationOptions(dish, allIngredients);
  }, [dish, allIngredients]);

  useEffect(() => {
    if (initialData) {
      setQuantity(initialData.quantity);
      setNotes(initialData.notes);
      setSelectedOptions(new Set(initialData.selectedCustomizations.map(o => o.optionId)));
    } else {
      setQuantity(1);
      setNotes('');
      setSelectedOptions(new Set());
      setCookingPreference('');
    }
  }, [initialData, isOpen]);

  const extrasCost = useMemo(() => {
    return Array.from(selectedOptions).reduce((total, optionId) => {
      const option = customizationOptions.find(o => o.id === optionId);
      return total + (option?.extraCost || 0);
    }, 0);
  }, [selectedOptions, customizationOptions]);

  const subtotal = (dish.price + extrasCost) * quantity;

  const toggleOption = (option: DishCustomizationOption) => {
    setSelectedOptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(option.id)) {
        newSet.delete(option.id);
      } else {
        newSet.add(option.id);
      }
      return newSet;
    });
  };

  const selectedCustomizations = useMemo((): SelectedCustomization[] => {
    const options: SelectedCustomization[] = [];
    Array.from(selectedOptions).forEach(optionId => {
      const option = customizationOptions.find(o => o.id === optionId);
      if (option) {
        options.push({
          optionId: option.id,
          label: option.label,
          type: option.type,
          ingredientId: option.ingredientId,
          extraCost: option.extraCost,
        });
      }
    });
    return options;
  }, [selectedOptions, customizationOptions]);

  const finalIngredients = useMemo((): RecipeIngredient[] => {
    const ingredients = [...dish.recipe];
    selectedCustomizations.forEach(custom => {
      if (custom.type === 'remove' && custom.ingredientId) {
        return ingredients.filter(i => i.ingredientId !== custom.ingredientId);
      }
      // Add or swap would modify ingredients here
    });
    return ingredients;
  }, [dish.recipe, selectedCustomizations]);

  const handleSubmit = () => {
    onAddToOrder({
      dish,
      quantity,
      notes,
      selectedCustomizations,
    });
    onClose();
  };

  const showCookingOptions = ['hamburguesas', 'minutas'].includes(dish.category);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-scrim backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-canvas border-l border-line z-50 overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-ink font-bold text-xl">{dish.name}</h2>
                  <p className="text-ink-3 text-sm mt-1">${dish.price.toFixed(2)} base</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-surface-3 rounded-lg"
                >
                  <X size={20} className="text-ink-3" />
                </button>
              </div>

              {dish.description && (
                <p className="text-ink-3 text-sm mb-6">{dish.description}</p>
              )}

              <div className="mb-6">
                <h3 className="text-ink font-medium mb-3">Ingredientes incluidos</h3>
                <div className="flex flex-wrap gap-2">
                  {dish.recipe.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm ${ing.isRemovable ? 'bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-surface-3 text-ink-3'}`}>
                        {ing.ingredientName}
                      </span>
                      {ing.isRemovable && (
                        <button
                          onClick={() => {
                            const optId = `remove-${ing.ingredientId}`;
                            toggleOption({
                              id: optId,
                              label: `Quitar ${ing.ingredientName}`,
                              type: 'remove',
                              ingredientId: ing.ingredientId,
                              extraCost: 0,
                              isDefault: false,
                            });
                          }}
                          className="text-red-700 dark:text-red-400 hover:text-red-600"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {customizationOptions.filter(o => o.type === 'add').length > 0 && (
                <div className="mb-6">
                  <h3 className="text-ink font-medium mb-3">Agregados disponibles</h3>
                  <div className="flex flex-wrap gap-2">
                    {customizationOptions
                      .filter(o => o.type === 'add')
                      .map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => toggleOption(opt)}
                          className={`px-4 py-2 rounded-full text-sm transition-all ${
                            selectedOptions.has(opt.id)
                              ? 'bg-brand text-on-brand'
                              : 'bg-surface-3 text-ink-3 hover:text-ink'
                          }`}
                        >
                          {opt.label}
                          {opt.extraCost > 0 && ` +$${opt.extraCost.toFixed(0)}`}
                          {opt.extraCost === 0 && ' gratis'}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {showCookingOptions && (
                <div className="mb-6">
                  <h3 className="text-ink font-medium mb-3">Preferencia de cocción</h3>
                  <div className="flex gap-2">
                    {['Jugosa', 'A punto', 'Bien cocida'].map(pref => (
                      <button
                        key={pref}
                        onClick={() => setCookingPreference(pref)}
                        className={`px-4 py-2 rounded-full text-sm transition-all ${
                          cookingPreference === pref
                            ? 'bg-brand text-on-brand'
                            : 'bg-surface-3 text-ink-3 hover:text-ink'
                        }`}
                      >
                        {pref}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label className="text-ink font-medium mb-2 block">
                  Notas para cocina
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink h-24"
                  placeholder="Ej: sin sal, aparte la salsa, bien tostado el pan"
                />
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-ink font-medium">Cantidad</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2 rounded-lg bg-surface-3 text-ink hover:bg-surface-3"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="text-ink font-bold text-xl w-8 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(20, quantity + 1))}
                      className="p-2 rounded-lg bg-surface-3 text-ink hover:bg-surface-3"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-line pt-4 mb-6">
                <div className="flex justify-between items-center text-lg">
                  <span className="text-ink-3">Subtotal</span>
                  <span className="text-ink font-bold">${subtotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!dish.isAvailable || dish.maxAvailable < quantity}
                className="w-full px-4 py-4 bg-brand text-on-brand rounded-lg hover:bg-brand-strong font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!dish.isAvailable ? 'Agotado' : 'Agregar al pedido'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
