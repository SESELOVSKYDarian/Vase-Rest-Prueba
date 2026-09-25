'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, UtensilsCrossed, Tag } from 'lucide-react';
import { DishAdminCard } from '@/components/platos/DishAdminCard';
import { DishFormPanel } from '@/components/platos/DishFormPanel';
import { PromotionCard } from '@/components/promociones/PromotionCard';
import { PromotionFormModal } from '@/components/promociones/PromotionFormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ingredientesService } from '@/services/ingredientesService';
import { platosService } from '@/services/platosService';
import { promocionesService, type PromocionInput } from '@/services/promocionesService';
import type { Ingrediente, Plato, PlatoInput } from '@/types/platos';
import type { Promotion } from '@/types/promotions';
import { EmptyState } from '@/components/ui/EmptyState';

const PROMO_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'expired', label: 'Vencidas' },
] as const;

type PromoFilter = (typeof PROMO_FILTERS)[number]['value'];

export default function PlatosPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'platos' | 'promociones'>(searchParams.get('tab') === 'promociones' ? 'promociones' : 'platos');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [platoToEdit, setPlatoToEdit] = useState<Plato | undefined>();
  const [platoToDelete, setPlatoToDelete] = useState<Plato | undefined>();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [promoFilter, setPromoFilter] = useState<PromoFilter>('all');
  const [isPromoFormOpen, setIsPromoFormOpen] = useState(false);
  const [promoToEdit, setPromoToEdit] = useState<Promotion | undefined>();
  const [promoToDelete, setPromoToDelete] = useState<Promotion | undefined>();
  const [promoMutationError, setPromoMutationError] = useState<string | null>(null);

  const platosQuery = useQuery({
    queryKey: ['platos', 'productos'],
    queryFn: platosService.getPlatos,
  });

  const categoriasQuery = useQuery({
    queryKey: ['platos', 'categorias'],
    queryFn: platosService.getCategorias,
  });

  const ingredientesQuery = useQuery({
    queryKey: ['platos', 'ingredientes'],
    queryFn: ingredientesService.getIngredientes,
  });

  const promocionesQuery = useQuery({
    queryKey: ['promociones'],
    queryFn: promocionesService.getPromociones,
  });

  const invalidatePlatos = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['platos'] }),
      queryClient.invalidateQueries({ queryKey: ['productos', 'catalogo', 'disponibles'] }),
    ]);
  };

  const invalidatePromociones = async () => {
    await queryClient.invalidateQueries({ queryKey: ['promociones'] });
  };

  const saveMutation = useMutation({
    mutationFn: (input: PlatoInput) => {
      if (platoToEdit) return platosService.updatePlato(platoToEdit.id, input);
      return platosService.createPlato(input);
    },
    onSuccess: async () => {
      setMutationError(null);
      setIsFormOpen(false);
      setPlatoToEdit(undefined);
      await invalidatePlatos();
    },
    onError: (error) => {
      setMutationError(error instanceof Error ? error.message : 'No se pudo guardar el plato.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platosService.softDeletePlato(id),
    onSuccess: async () => {
      setMutationError(null);
      setPlatoToDelete(undefined);
      await invalidatePlatos();
    },
    onError: (error) => {
      setMutationError(error instanceof Error ? error.message : 'No se pudo eliminar el plato.');
    },
  });

  const createIngredientMutation = useMutation({
    mutationFn: ingredientesService.createIngrediente,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['platos', 'ingredientes'] });
    },
  });

  const savePromoMutation = useMutation({
    mutationFn: (input: PromocionInput) => {
      if (promoToEdit) return promocionesService.updatePromocion(promoToEdit.id, input);
      return promocionesService.createPromocion(input);
    },
    onSuccess: async () => {
      setPromoMutationError(null);
      setIsPromoFormOpen(false);
      setPromoToEdit(undefined);
      await invalidatePromociones();
    },
    onError: (error) => {
      setPromoMutationError(error instanceof Error ? error.message : 'No se pudo guardar la promoción.');
    },
  });

  const deletePromoMutation = useMutation({
    mutationFn: (id: string) => promocionesService.deletePromocion(id),
    onSuccess: async () => {
      setPromoMutationError(null);
      setPromoToDelete(undefined);
      await invalidatePromociones();
    },
    onError: (error) => {
      setPromoMutationError(error instanceof Error ? error.message : 'No se pudo eliminar la promoción.');
    },
  });

  const toggleActivoMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => promocionesService.toggleActivo(id, activo),
    onSuccess: invalidatePromociones,
  });

  const platos = platosQuery.data ?? [];
  const categorias = categoriasQuery.data ?? [];
  const ingredientes = ingredientesQuery.data ?? [];
  const promociones = promocionesQuery.data ?? [];

  const categoriesForFilter = useMemo(() => {
    const fromProducts = new Map<string, string>();
    platos.forEach((plato) => {
      if (plato.categoriaId) fromProducts.set(plato.categoriaId, plato.categoriaNombre);
    });
    categorias.forEach((category) => fromProducts.set(category.id, category.nombre));
    return Array.from(fromProducts.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [categorias, platos]);

  const filteredPlatos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return platos.filter((plato) => {
      const matchesCategory = selectedCategory === 'all' || plato.categoriaId === selectedCategory;
      const matchesSearch = !query || plato.nombre.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [platos, searchQuery, selectedCategory]);

  const filteredPromociones = useMemo(() => {
    return promociones.filter((promo) => {
      if (promoFilter === 'active') return promo.isActive;
      if (promoFilter === 'expired') return promo.expirationDate < new Date();
      return true;
    }).sort((a, b) => {
      const aIsActive = a.isActive && a.expirationDate > new Date();
      const bIsActive = b.isActive && b.expirationDate > new Date();
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      return a.expirationDate.getTime() - b.expirationDate.getTime();
    });
  }, [promociones, promoFilter]);

  const openCreate = () => {
    setMutationError(null);
    setPlatoToEdit(undefined);
    setIsFormOpen(true);
  };

  const openEdit = (plato: Plato) => {
    setMutationError(null);
    setPlatoToEdit(plato);
    setIsFormOpen(true);
  };

  const openCreatePromo = () => {
    setPromoMutationError(null);
    setPromoToEdit(undefined);
    setIsPromoFormOpen(true);
  };

  const openEditPromo = (promo: Promotion) => {
    setPromoMutationError(null);
    setPromoToEdit(promo);
    setIsPromoFormOpen(true);
  };

  const handleCreateIngredient = async (input: {
    nombre: string;
    unidadMedida: string;
    stockActual: number;
    stockMinimo: number;
  }): Promise<Ingrediente> => {
    return createIngredientMutation.mutateAsync(input);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-2">Menú</h1>
          <p className="text-ink-3">
            {tab === 'platos' ? 'Tu carta: precios, categorías y recetas.' : 'Descuentos y ofertas sobre tus platos.'}
          </p>
        </div>
        {tab === 'platos' ? (
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 bg-brand text-on-brand rounded-lg hover:bg-brand-strong flex items-center gap-2"
          >
            <Plus size={16} />
            Nuevo plato
          </button>
        ) : (
          <button
            type="button"
            onClick={openCreatePromo}
            className="px-4 py-2 bg-brand text-on-brand rounded-lg hover:bg-brand-strong flex items-center gap-2"
          >
            <Plus size={16} />
            Nueva promoción
          </button>
        )}
      </div>

      <div className="flex rounded-xl bg-surface p-1 w-fit mb-8">
        <button
          onClick={() => setTab('platos')}
          className={`flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ${tab === 'platos' ? 'bg-brand text-on-brand' : 'text-ink-3 hover:text-ink'}`}
        >
          <UtensilsCrossed size={15} />Platos
        </button>
        <button
          onClick={() => setTab('promociones')}
          className={`flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ${tab === 'promociones' ? 'bg-brand text-on-brand' : 'text-ink-3 hover:text-ink'}`}
        >
          <Tag size={15} />Promociones
        </button>
      </div>

      {tab === 'platos' ? (
        <>
          {(mutationError || platosQuery.error || ingredientesQuery.error) && (
            <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-200">
              {mutationError ||
                (platosQuery.error instanceof Error ? platosQuery.error.message : null) ||
                (ingredientesQuery.error instanceof Error ? ingredientesQuery.error.message : null)}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" size={18} />
              <input
                type="text"
                placeholder="Buscar plato..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full bg-surface-2 border border-line rounded-lg pl-10 pr-4 py-2 text-ink"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="bg-surface-2 border border-line rounded-lg px-4 py-2 text-ink"
            >
              <option value="all">Todas</option>
              {categoriesForFilter.map((category) => (
                <option key={category.id} value={category.id}>{category.nombre}</option>
              ))}
            </select>
          </div>

          {platosQuery.isLoading ? (
            <p className="text-ink-3 text-center py-12">Cargando platos…</p>
          ) : filteredPlatos.length === 0 ? (
            <EmptyState
              variant={platos.length === 0 ? 'empty' : 'search'}
              title={platos.length === 0 ? 'Tu carta está vacía' : 'Ningún plato coincide'}
              hint={platos.length === 0 ? 'Cargá el primer plato con su precio y categoría.' : 'Probá con otra palabra o cambiá la categoría.'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredPlatos.map((plato) => (
                <DishAdminCard
                  key={plato.id}
                  plato={plato}
                  onEdit={() => openEdit(plato)}
                  onDelete={() => setPlatoToDelete(plato)}
                />
              ))}
            </div>
          )}

          <DishFormPanel
            key={`${isFormOpen ? 'open' : 'closed'}-${platoToEdit?.id || 'new'}`}
            isOpen={isFormOpen}
            onClose={() => {
              setIsFormOpen(false);
              setPlatoToEdit(undefined);
            }}
            platoToEdit={platoToEdit}
            categorias={categorias}
            ingredientes={ingredientes}
            isSaving={saveMutation.isPending}
            onSubmit={(input) => saveMutation.mutate(input)}
            onCreateIngredient={handleCreateIngredient}
          />

          <ConfirmDialog
            isOpen={!!platoToDelete}
            onClose={() => setPlatoToDelete(undefined)}
            onConfirm={() => {
              if (platoToDelete) deleteMutation.mutate(platoToDelete.id);
            }}
            title={`Eliminar "${platoToDelete?.nombre || ''}"`}
            message="El plato se desactivara en productos.activo y no se eliminara historicamente."
          />
        </>
      ) : (
        <>
          {(promoMutationError || promocionesQuery.error) && (
            <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-200">
              {promoMutationError || (promocionesQuery.error instanceof Error ? promocionesQuery.error.message : null)}
            </div>
          )}

          <div className="flex justify-end mb-6">
            <select
              value={promoFilter}
              onChange={(e) => setPromoFilter(e.target.value as PromoFilter)}
              className="bg-surface-2 border border-line rounded-lg px-4 py-2 text-ink"
            >
              {PROMO_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {promocionesQuery.isLoading ? (
            <p className="text-ink-3 text-center py-12">Cargando promociones reales...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredPromociones.map((promo) => (
                <PromotionCard
                  key={promo.id}
                  promotion={promo}
                  onEdit={() => openEditPromo(promo)}
                  onDelete={() => setPromoToDelete(promo)}
                  onToggleActive={() => toggleActivoMutation.mutate({ id: promo.id, activo: !promo.isActive })}
                />
              ))}
              {filteredPromociones.length === 0 && (
                <EmptyState
                  className="col-span-full"
                  title="Sin promociones todavía"
                  hint="Creá un descuento sobre uno o varios platos, con fechas y medios de pago."
                />
              )}
            </div>
          )}

          <PromotionFormModal
            key={`${isPromoFormOpen ? 'open' : 'closed'}-${promoToEdit?.id || 'new'}`}
            isOpen={isPromoFormOpen}
            onClose={() => {
              setIsPromoFormOpen(false);
              setPromoToEdit(undefined);
            }}
            onSubmit={(input) => savePromoMutation.mutate(input)}
            isSaving={savePromoMutation.isPending}
            platos={platos}
            promotionToEdit={promoToEdit}
          />

          <ConfirmDialog
            isOpen={!!promoToDelete}
            onClose={() => setPromoToDelete(undefined)}
            onConfirm={() => {
              if (promoToDelete) deletePromoMutation.mutate(promoToDelete.id);
            }}
            title={`Eliminar "${promoToDelete?.name || ''}"`}
            message="¿Estás seguro de que querés eliminar esta promoción?"
          />
        </>
      )}
    </div>
  );
}
