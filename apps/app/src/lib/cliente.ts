import { create } from 'zustand';
import type { Idioma } from '@vase/api';

/** Estado del celular del cliente (la carta del QR): lo que va eligiendo, el idioma y sus comprobantes. */
export interface LineaCliente { productoId: string; cantidad: number; notas: string }

interface ClienteState {
  lineas: LineaCliente[];
  agregar: (productoId: string, cantidad?: number) => void;
  fijar: (productoId: string, cantidad: number) => void;
  fijarNotas: (productoId: string, notas: string) => void;
  vaciar: () => void;
}

export const useCliente = create<ClienteState>((set) => ({
  lineas: [],
  agregar: (productoId, cantidad = 1) =>
    set((s) => {
      const i = s.lineas.findIndex((l) => l.productoId === productoId);
      if (i >= 0) return { lineas: s.lineas.map((l, k) => (k === i ? { ...l, cantidad: Math.min(20, l.cantidad + cantidad) } : l)) };
      return { lineas: [...s.lineas, { productoId, cantidad, notas: '' }] };
    }),
  fijar: (productoId, cantidad) =>
    set((s) => ({ lineas: cantidad <= 0 ? s.lineas.filter((l) => l.productoId !== productoId) : s.lineas.map((l) => (l.productoId === productoId ? { ...l, cantidad: Math.min(20, cantidad) } : l)) })),
  fijarNotas: (productoId, notas) => set((s) => ({ lineas: s.lineas.map((l) => (l.productoId === productoId ? { ...l, notas: notas.slice(0, 140) } : l)) })),
  vaciar: () => set({ lineas: [] }),
}));

// --- Preferencias guardadas en el navegador (si no se puede, la carta funciona igual) ---

const leer = (clave: string): string | null => {
  try { return globalThis.localStorage?.getItem(clave) ?? null; } catch { return null; }
};
const escribir = (clave: string, valor: string) => {
  try { globalThis.localStorage?.setItem(clave, valor); } catch { /* modo privado o sin almacenamiento */ }
};

export const idiomaGuardado = (): Idioma | null => {
  const v = leer('vase-idioma');
  return v === 'es' || v === 'en' || v === 'pt' ? v : null;
};
export const guardarIdioma = (i: Idioma) => escribir('vase-idioma', i);

/** Comprobantes de pago de este celular, por mesa: así vuelve a verlos si recarga la página. */
export function comprobantesGuardados(mesa: number): string[] {
  try { return (JSON.parse(leer('vase-comprobantes') ?? '{}') as Record<string, string[]>)[String(mesa)] ?? []; } catch { return []; }
}
export function guardarComprobante(mesa: number, codigo: string) {
  let todos: Record<string, string[]> = {};
  try { todos = JSON.parse(leer('vase-comprobantes') ?? '{}'); } catch { /* vacío */ }
  const lista = [codigo, ...(todos[String(mesa)] ?? []).filter((c) => c !== codigo)].slice(0, 12);
  escribir('vase-comprobantes', JSON.stringify({ ...todos, [String(mesa)]: lista }));
}
