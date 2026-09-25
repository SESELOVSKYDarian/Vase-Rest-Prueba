'use client';

import { create } from 'zustand';
import { THEME_STORAGE_KEY, type ThemeMode } from '@/config/theme';

interface ThemeState {
  mode: ThemeMode;
  hydrate: () => void;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

// Preferencia de cada persona (su pantalla, su luz ambiente): vive en su navegador,
// no en la config compartida del local. El script de app/layout.tsx la aplica antes
// del primer pintado; este store la mantiene sincronizada desde la UI.
function apply(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // almacenamiento bloqueado: el tema igual se aplica en esta sesión
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  hydrate: () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    set({ mode: current });
  },
  setMode: (mode) => {
    apply(mode);
    set({ mode });
  },
  toggle: () => get().setMode(get().mode === 'dark' ? 'light' : 'dark'),
}));
