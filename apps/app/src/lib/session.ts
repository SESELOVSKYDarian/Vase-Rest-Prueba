import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { configureApi, iniciarSesion, type Usuario } from '@vase/api';
import type { ThemeMode } from '@vase/ui';
import { secureStorage } from './storage';

/** Dirección del servidor por defecto según dónde corra la app. */
export function urlServidorPorDefecto(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env;
  if (Platform.OS === 'web') {
    const loc = globalThis.location;
    return `${loc?.protocol ?? 'http:'}//${loc?.hostname ?? 'localhost'}:3001/api`;
  }
  // En el emulador de Android, el host de la PC es 10.0.2.2.
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001/api';
  return 'http://localhost:3001/api';
}

interface SessionState {
  token: string | null;
  usuario: Usuario | null;
  /** Dirección elegida por la persona (servidor del local); vacío = la de por defecto. */
  servidor: string;
  tema: ThemeMode;
  hidratado: boolean;
  cargando: boolean;
  error: string | null;
  entrar: (usuario: string, password: string) => Promise<boolean>;
  salir: () => void;
  setServidor: (url: string) => void;
  setTema: (tema: ThemeMode) => void;
  limpiarError: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      servidor: '',
      tema: 'system',
      hidratado: false,
      cargando: false,
      error: null,
      entrar: async (usuario, password) => {
        set({ cargando: true, error: null });
        try {
          const sesion = await iniciarSesion(usuario.trim(), password);
          set({ token: sesion.token, usuario: sesion.usuario, cargando: false });
          return true;
        } catch (error) {
          set({ cargando: false, error: error instanceof Error ? error.message : 'No se pudo iniciar sesión' });
          return false;
        }
      },
      salir: () => set({ token: null, usuario: null }),
      setServidor: (servidor) => set({ servidor }),
      setTema: (tema) => set({ tema }),
      limpiarError: () => set({ error: null }),
    }),
    {
      name: 'vase-sesion',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ token: state.token, usuario: state.usuario, servidor: state.servidor, tema: state.tema }),
      onRehydrateStorage: () => () => { useSession.setState({ hidratado: true }); },
    },
  ),
);

/** Mantiene el cliente HTTP sincronizado con la sesión y el servidor elegido. */
export function conectarApiConSesion() {
  const aplicar = () => {
    const { servidor, token } = useSession.getState();
    configureApi({
      baseUrl: servidor || urlServidorPorDefecto(),
      getToken: () => token,
      onUnauthorized: () => { if (useSession.getState().token) useSession.getState().salir(); },
    });
  };
  aplicar();
  return useSession.subscribe(aplicar);
}
