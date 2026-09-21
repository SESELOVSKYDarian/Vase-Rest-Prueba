'use client';

import { create } from 'zustand';

interface MobileNavState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

// Compartido entre el hamburguesa+drawer del Sidebar y el botón "Más" del
// MobileBottomNav — ambos abren/cierran el mismo panel de navegación completo.
export const useMobileNavStore = create<MobileNavState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
