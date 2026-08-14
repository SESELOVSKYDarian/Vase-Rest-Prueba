'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser { id?: string; nombre: string; username?: string; email?: string; rol: string }
interface AuthState {
  usuario: AuthUser | null; token: string | null; isAuthenticated: boolean; isLoading: boolean; error: string | null;
  login: (usuario: string, password: string) => Promise<boolean>; logout: () => void; clearError: () => void;
}

export const useAuthStore = create<AuthState>()(persist((set) => ({
  usuario: null, token: null, isAuthenticated: false, isLoading: false, error: null,
  login: async (usuario, password) => {
    set({ isLoading: true, error: null });
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Usuario o contraseña incorrectos');
      set({ usuario: result.usuario, token: result.token, isAuthenticated: true, isLoading: false, error: null });
      document.cookie = `noctua-auth=${encodeURIComponent(JSON.stringify({ state: { isAuthenticated: true } }))}; path=/; samesite=lax`;
      return true;
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'No se pudo iniciar sesión' });
      return false;
    }
  },
  logout: () => { document.cookie = 'noctua-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'; set({ usuario: null, token: null, isAuthenticated: false, error: null }); },
  clearError: () => set({ error: null }),
}), { name: 'noctua-auth', partialize: (state) => ({ usuario: state.usuario, token: state.token, isAuthenticated: state.isAuthenticated }) }));
