'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { DishSelector } from '@/components/promociones/DishSelector';
import type { PromocionInput } from '@/services/promocionesService';
import type { Plato } from '@/types/platos';
import type { Promotion, PaymentMethod } from '@/types/promotions';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercadopago', label: 'Mercado Pago' },
];

interface PromotionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: PromocionInput) => void;
  isSaving?: boolean;
  platos: Plato[];
  promotionToEdit?: Promotion;
}

export function PromotionFormModal({ isOpen, onClose, onSubmit, isSaving, platos, promotionToEdit }: PromotionFormModalProps) {
  const [name, setName] = useState(() => promotionToEdit?.name || '');
  const [description, setDescription] = useState(() => promotionToEdit?.description || '');
  const [discountPercentage, setDiscountPercentage] = useState(() => promotionToEdit?.discountPercentage.toString() || '');
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>(() => promotionToEdit?.applicableDishes.map((d) => d.dishId) || []);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => promotionToEdit?.paymentMethods.filter((m) => m !== 'todos') || []);
  const [allPaymentMethods, setAllPaymentMethods] = useState(() => promotionToEdit?.paymentMethods.includes('todos') ?? false);
  const [startDate, setStartDate] = useState(() => promotionToEdit?.startDate.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]);
  const [expirationDate, setExpirationDate] = useState(() => promotionToEdit?.expirationDate.toISOString().split('T')[0] || '');
  const [activateImmediately, setActivateImmediately] = useState(() => promotionToEdit?.isActive ?? true);

  const discountValue = useMemo(() => parseFloat(discountPercentage) || 0, [discountPercentage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalPaymentMethods: PaymentMethod[] = allPaymentMethods ? ['todos'] : paymentMethods;

    onSubmit({
      nombre: name,
      descripcion: description || undefined,
      discountPercentage: discountValue,
      productoIds: selectedDishIds,
      metodosPago: finalPaymentMethods,
      fechaInicio: startDate,
      fechaFin: expirationDate,
      activo: activateImmediately,
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
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl max-h-[90vh] overflow-y-auto bg-canvas border border-line rounded-2xl z-50"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-ink font-bold text-xl">
                  {promotionToEdit ? 'Editar promoción' : 'Nueva promoción'}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-surface-3 rounded-lg"
                >
                  <X size={20} className="text-ink-3" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-ink text-sm font-medium mb-1 block">
                    Nombre de la promoción
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink"
                    placeholder="Ej: Happy Hour"
                  />
                </div>

                <div>
                  <label className="text-ink text-sm font-medium mb-1 block">
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink h-20"
                    placeholder="Descripción de la promoción"
                  />
                </div>

                <div>
                  <label className="text-ink text-sm font-medium mb-1 block">
                    Porcentaje de descuento (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value)}
                    required
                    className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink"
                    placeholder="10"
                  />
                </div>

                <div>
                  <label className="text-ink text-sm font-medium mb-1 block">
                    Platos incluidos
                  </label>
                  <DishSelector
                    platos={platos}
                    selectedDishIds={selectedDishIds}
                    onChange={setSelectedDishIds}
                    discountPercentage={discountValue}
                  />
                </div>

                <div>
                  <label className="text-ink text-sm font-medium mb-2 block">
                    Métodos de pago
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-ink text-sm">
                      <input
                        type="checkbox"
                        checked={allPaymentMethods}
                        onChange={(e) => setAllPaymentMethods(e.target.checked)}
                        className="rounded"
                      />
                      Todos los métodos de pago
                    </label>
                    {!allPaymentMethods && PAYMENT_METHODS.map((method) => (
                      <label key={method.value} className="flex items-center gap-2 text-ink text-sm">
                        <input
                          type="checkbox"
                          checked={paymentMethods.includes(method.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPaymentMethods([...paymentMethods, method.value]);
                            } else {
                              setPaymentMethods(paymentMethods.filter((m) => m !== method.value));
                            }
                          }}
                          className="rounded"
                        />
                        {method.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-ink text-sm font-medium mb-1 block">
                      Fecha de inicio
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink"
                    />
                  </div>
                  <div>
                    <label className="text-ink text-sm font-medium mb-1 block">
                      Fecha de vencimiento
                    </label>
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      required
                      className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-ink text-sm">
                  <input
                    type="checkbox"
                    checked={activateImmediately}
                    onChange={(e) => setActivateImmediately(e.target.checked)}
                    className="rounded"
                  />
                  Activar inmediatamente
                </label>

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
                    disabled={
                      isSaving ||
                      !name ||
                      !discountPercentage ||
                      selectedDishIds.length === 0 ||
                      (!allPaymentMethods && paymentMethods.length === 0) ||
                      !expirationDate ||
                      new Date(expirationDate) <= new Date(startDate)
                    }
                    className="flex-1 px-4 py-2 bg-brand text-on-brand rounded-lg hover:bg-brand-strong disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Guardando...' : promotionToEdit ? 'Actualizar' : 'Crear'}
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
