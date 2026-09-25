'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X } from 'lucide-react';
import type { CategoriaPlato, Ingrediente, Plato, PlatoInput } from '@/types/platos';

interface DishFormPanelProps {
  isOpen: boolean;
  onClose: () => void;
  platoToEdit?: Plato;
  categorias: CategoriaPlato[];
  ingredientes: Ingrediente[];
  isSaving: boolean;
  onSubmit: (input: PlatoInput) => void;
  onCreateIngredient: (input: {
    nombre: string;
    unidadMedida: string;
    stockActual: number;
    stockMinimo: number;
  }) => Promise<Ingrediente>;
}

type RecipeDraft = {
  ingredienteId: string;
  cantidadNecesaria: string;
  unidad: string;
};

const UNIT_OPTIONS = ['unidades', 'kg', 'gramos', 'litros', 'atado'];

function createRecipeDraftFromPlato(plato?: Plato): RecipeDraft[] {
  if (!plato) return [];
  return plato.receta.map((item) => ({
    ingredienteId: item.ingredienteId,
    cantidadNecesaria: String(item.cantidadNecesaria),
    unidad: item.unidad,
  }));
}

export function DishFormPanel({
  isOpen,
  onClose,
  platoToEdit,
  categorias,
  ingredientes,
  isSaving,
  onSubmit,
  onCreateIngredient,
}: DishFormPanelProps) {
  const [name, setName] = useState(() => platoToEdit?.nombre || '');
  const [categoryId, setCategoryId] = useState<string>(() => platoToEdit?.categoriaId || categorias[0]?.id || '');
  const [price, setPrice] = useState(() => (platoToEdit ? String(platoToEdit.precio) : ''));
  const [description, setDescription] = useState(() => platoToEdit?.descripcion || '');
  const [stockActual, setStockActual] = useState(() => (platoToEdit ? String(platoToEdit.stockActual) : '0'));
  const [recipe, setRecipe] = useState<RecipeDraft[]>(() => createRecipeDraftFromPlato(platoToEdit));
  const [formError, setFormError] = useState<string | null>(null);

  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState('unidades');
  const [newIngredientStock, setNewIngredientStock] = useState('0');
  const [newIngredientMinStock, setNewIngredientMinStock] = useState('0');
  const [creatingIngredient, setCreatingIngredient] = useState(false);

  const ingredientMap = useMemo(() => {
    const map = new Map<string, Ingrediente>();
    ingredientes.forEach((ingredient) => map.set(ingredient.id, ingredient));
    return map;
  }, [ingredientes]);

  const maxAvailable = useMemo(() => {
    const values = recipe
      .map((item) => {
        const ingredient = ingredientMap.get(item.ingredienteId);
        const qty = Number(item.cantidadNecesaria);
        if (!ingredient || !qty || qty <= 0) return null;
        return Math.floor(ingredient.stockActual / qty);
      })
      .filter((value): value is number => value !== null);

    if (values.length === 0) return 0;
    return Math.max(0, Math.min(...values));
  }, [ingredientMap, recipe]);


  const addRecipeRow = () => {
    setRecipe((current) => [
      ...current,
      {
        ingredienteId: '',
        cantidadNecesaria: '1',
        unidad: 'unidades',
      },
    ]);
  };

  const updateRecipeRow = (index: number, updates: Partial<RecipeDraft>) => {
    setRecipe((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...updates };
        if (updates.ingredienteId) {
          const ingredient = ingredientMap.get(updates.ingredienteId);
          if (ingredient) next.unidad = ingredient.unidadMedida;
        }
        return next;
      })
    );
  };

  const removeRecipeRow = (index: number) => {
    setRecipe((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleCreateIngredient = async () => {
    setFormError(null);
    const nombre = newIngredientName.trim();
    if (!nombre) {
      setFormError('El nuevo ingrediente necesita nombre.');
      return;
    }

    setCreatingIngredient(true);
    try {
      const created = await onCreateIngredient({
        nombre,
        unidadMedida: newIngredientUnit,
        stockActual: Number(newIngredientStock || 0),
        stockMinimo: Number(newIngredientMinStock || 0),
      });
      setRecipe((current) => [
        ...current,
        {
          ingredienteId: created.id,
          cantidadNecesaria: '1',
          unidad: created.unidadMedida,
        },
      ]);
      setNewIngredientName('');
      setNewIngredientStock('0');
      setNewIngredientMinStock('0');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo crear el ingrediente.');
    } finally {
      setCreatingIngredient(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsedRecipe = recipe.map((item) => ({
      ingredienteId: item.ingredienteId,
      cantidadNecesaria: Number(item.cantidadNecesaria),
      unidad: item.unidad,
    }));

    const duplicated = new Set<string>();
    for (const item of parsedRecipe) {
      if (duplicated.has(item.ingredienteId)) {
        setFormError('No repitas ingredientes dentro de la misma receta.');
        return;
      }
      if (item.ingredienteId) duplicated.add(item.ingredienteId);
    }

    onSubmit({
      nombre: name,
      descripcion: description,
      precio: Number(price || 0),
      categoriaId: categoryId || null,
      stockActual: Number(stockActual || 0),
      receta: parsedRecipe,
    });
  };

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
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-canvas border-l border-line z-50 overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-ink font-bold text-xl">
                  {platoToEdit ? 'Editar plato' : 'Nuevo plato'}
                </h2>
                <button type="button" onClick={onClose} className="p-2 hover:bg-surface-3 rounded-lg">
                  <X size={20} className="text-ink-3" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {formError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-ink text-sm font-medium mb-1 block">Nombre del plato</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink"
                    />
                  </label>

                  <label className="block">
                    <span className="text-ink text-sm font-medium mb-1 block">Categoria</span>
                    <select
                      value={categoryId}
                      onChange={(event) => setCategoryId(event.target.value)}
                      className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink"
                    >
                      <option value="">Sin categoria</option>
                      {categorias.map((category) => (
                        <option key={category.id} value={category.id}>{category.nombre}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-ink text-sm font-medium mb-1 block">Precio</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      required
                      className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink"
                    />
                  </label>

                  <label className="block">
                    <span className="text-ink text-sm font-medium mb-1 block">Stock fallback del producto</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={stockActual}
                      onChange={(event) => setStockActual(event.target.value)}
                      className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-ink text-sm font-medium mb-1 block">Descripcion</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink h-24"
                  />
                </label>

                <section className="rounded-xl border border-line bg-surface p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-ink font-semibold">Receta</h3>
                      <p className="text-xs text-ink-3">Minimo un ingrediente para guardar.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addRecipeRow}
                      className="flex items-center gap-1 text-brand hover:text-brand text-sm"
                    >
                      <Plus size={16} />
                      Anadir
                    </button>
                  </div>

                  {recipe.map((item, index) => (
                    <div key={`${item.ingredienteId}-${index}`} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        value={item.ingredienteId}
                        onChange={(event) => updateRecipeRow(index, { ingredienteId: event.target.value })}
                        className="col-span-6 bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink"
                      >
                        <option value="">Seleccionar ingrediente...</option>
                        {ingredientes.map((ingredient) => (
                          <option key={ingredient.id} value={ingredient.id}>{ingredient.nombre}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.cantidadNecesaria}
                        onChange={(event) => updateRecipeRow(index, { cantidadNecesaria: event.target.value })}
                        className="col-span-2 bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink"
                      />
                      <input
                        value={item.unidad}
                        onChange={(event) => updateRecipeRow(index, { unidad: event.target.value })}
                        className="col-span-3 bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink"
                      />
                      <button
                        type="button"
                        onClick={() => removeRecipeRow(index)}
                        className="col-span-1 text-red-700 dark:text-red-400 hover:text-red-600 flex justify-end"
                        aria-label="Quitar ingrediente"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  <p className="text-ink-3 text-sm">
                    Con el stock actual de ingredientes podrias preparar <span className="text-ink font-bold">{maxAvailable}</span> unidades.
                  </p>
                </section>

                <section className="rounded-xl border border-line bg-surface p-4 space-y-3">
                  <h3 className="text-ink font-semibold">Crear ingrediente rapido</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      value={newIngredientName}
                      onChange={(event) => setNewIngredientName(event.target.value)}
                      placeholder="Nombre"
                      className="bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink"
                    />
                    <select
                      value={newIngredientUnit}
                      onChange={(event) => setNewIngredientUnit(event.target.value)}
                      className="bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink"
                    >
                      {UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newIngredientStock}
                      onChange={(event) => setNewIngredientStock(event.target.value)}
                      placeholder="Stock"
                      className="bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newIngredientMinStock}
                      onChange={(event) => setNewIngredientMinStock(event.target.value)}
                      placeholder="Minimo"
                      className="bg-canvas border border-line-strong rounded-lg px-3 py-2 text-sm text-ink"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreateIngredient()}
                    disabled={creatingIngredient}
                    className="px-4 py-2 bg-surface-3 text-ink rounded-lg hover:bg-surface-3 disabled:opacity-50"
                  >
                    {creatingIngredient ? 'Creando...' : 'Crear y agregar a receta'}
                  </button>
                </section>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-line text-ink rounded-lg hover:bg-surface-3"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-brand text-on-brand rounded-lg hover:bg-brand-strong disabled:opacity-50"
                  >
                    {isSaving ? 'Guardando...' : platoToEdit ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
