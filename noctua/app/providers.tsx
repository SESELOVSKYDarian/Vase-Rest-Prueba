'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/hooks/lib/queryClient';
import { ToastContainer } from '@/components/ui/Toast';
import { useSuperAdmStore } from '@/store/superadmStore';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getAccent } from '@/config/theme';
import { useEffect } from 'react';

function ThemeApplier() {
  const accentId = useSuperAdmStore((s) => s.config.theme.accent);
  const initializeConfig = useSuperAdmStore((s) => s.initializeConfig);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  // Este provider vive en la raíz de la app y no remonta al navegar de /login a
  // /dashboard (mismo árbol de React) — depender del token hace que la carga real
  // (Postgres, autenticada) se reintente en cuanto el login termina, en vez de haber
  // corrido una sola vez sin sesión y quedarse silenciosamente en el 401 (config
  // default) hasta que otra pantalla la vuelva a pedir por su cuenta.
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  useEffect(() => {
    if (token) initializeConfig();
  }, [token, initializeConfig]);

  // Solo tono y croma: la luminosidad de cada modo la fija globals.css.
  useEffect(() => {
    const accent = getAccent(accentId);
    const root = document.documentElement;
    root.style.setProperty('--brand-h', String(accent.hue));
    root.style.setProperty('--brand-c', String(accent.chroma));
  }, [accentId]);

  return null;
}

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      {children}
      <ToastContainer />
    </QueryClientProvider>
  );
}
