import { create } from 'zustand';

/** Lo que el mozo va sumando para una mesa, antes de enviarlo a cocina. */
interface CartState {
  mesaId: string | null;
  cantidades: Record<string, number>;
  iniciar: (mesaId: string) => void;
  fijar: (productoId: string, cantidad: number) => void;
  vaciar: () => void;
}

export const useCart = create<CartState>((set, get) => ({
  mesaId: null,
  cantidades: {},
  // Cambiar de mesa nunca arrastra el carrito de otra.
  iniciar: (mesaId) => { if (get().mesaId !== mesaId) set({ mesaId, cantidades: {} }); },
  fijar: (productoId, cantidad) =>
    set((state) => {
      const siguiente = { ...state.cantidades };
      if (cantidad <= 0) delete siguiente[productoId];
      else siguiente[productoId] = cantidad;
      return { cantidades: siguiente };
    }),
  vaciar: () => set({ cantidades: {} }),
}));
