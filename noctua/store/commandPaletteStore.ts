'use client';

import { create } from 'zustand';

interface CommandPaletteState {
  isOpen: boolean;
  initialQuery: string;
  // Se incrementa en cada open(): se usa como `key` del contenido de la paleta
  // para que cada apertura arranque con estado fresco sin resetear vía efecto.
  instanceId: number;
  open: (initialQuery?: string) => void;
  close: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set, get) => ({
  isOpen: false,
  initialQuery: '',
  instanceId: 0,
  open: (initialQuery = '') => set({ isOpen: true, initialQuery, instanceId: get().instanceId + 1 }),
  close: () => set({ isOpen: false, initialQuery: '' }),
}));
