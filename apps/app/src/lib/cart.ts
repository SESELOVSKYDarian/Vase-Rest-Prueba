import { create } from 'zustand';

/** Una línea del pedido: el mismo plato con aclaraciones distintas ("sin jamón") es otra línea. */
export interface LineaCarrito {
  clave: string;
  productoId: string;
  cantidad: number;
  notas: string;
}

const claveDe = (productoId: string, notas: string) => `${productoId}|${notas.trim().toLowerCase()}`;

/** Lo que el mozo va sumando para una mesa, antes de enviarlo a cocina. */
interface CartState {
  mesaId: string | null;
  lineas: LineaCarrito[];
  iniciar: (mesaId: string) => void;
  /** Cantidad del plato sin aclaraciones (lo que mueve el stepper de la carta). */
  fijar: (productoId: string, cantidad: number) => void;
  /** Suma líneas dictadas o con aclaraciones; si ya existe la misma, junta las cantidades. */
  agregar: (nuevas: Array<{ productoId: string; cantidad: number; notas?: string }>) => void;
  cambiarCantidad: (clave: string, cantidad: number, productoId?: string) => void;
  quitar: (clave: string) => void;
  vaciar: () => void;
}

export const useCart = create<CartState>((set, get) => ({
  mesaId: null,
  lineas: [],
  // Cambiar de mesa nunca arrastra el carrito de otra.
  iniciar: (mesaId) => { if (get().mesaId !== mesaId) set({ mesaId, lineas: [] }); },
  fijar: (productoId, cantidad) => get().cambiarCantidad(claveDe(productoId, ''), cantidad, productoId),
  agregar: (nuevas) =>
    set((state) => {
      const lineas = [...state.lineas];
      for (const n of nuevas) {
        const notas = (n.notas ?? '').trim();
        const clave = claveDe(n.productoId, notas);
        const i = lineas.findIndex((l) => l.clave === clave);
        if (i >= 0) lineas[i] = { ...lineas[i], cantidad: lineas[i].cantidad + n.cantidad };
        else lineas.push({ clave, productoId: n.productoId, cantidad: n.cantidad, notas });
      }
      return { lineas };
    }),
  cambiarCantidad: (clave, cantidad, productoId) =>
    set((state) => {
      const i = state.lineas.findIndex((l) => l.clave === clave);
      if (cantidad <= 0) return { lineas: state.lineas.filter((l) => l.clave !== clave) };
      if (i >= 0) return { lineas: state.lineas.map((l, k) => (k === i ? { ...l, cantidad } : l)) };
      const id = productoId ?? clave.split('|')[0];
      return { lineas: [...state.lineas, { clave, productoId: id, cantidad, notas: '' }] };
    }),
  quitar: (clave) => set((state) => ({ lineas: state.lineas.filter((l) => l.clave !== clave) })),
  vaciar: () => set({ lineas: [] }),
}));
