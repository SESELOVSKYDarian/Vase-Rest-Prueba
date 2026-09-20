'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/hooks/lib/queryClient';
import { ToastContainer } from '@/components/ui/Toast';
import { useSuperAdmStore } from '@/store/superadmStore';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';

function ThemeApplier() {
  const { config, initializeConfig } = useSuperAdmStore();
  // Este provider vive en la raíz de la app y no remonta al navegar de /login a
  // /dashboard (mismo árbol de React) — depender del token hace que la carga real
  // (Postgres, autenticada) se reintente en cuanto el login termina, en vez de haber
  // corrido una sola vez sin sesión y quedarse silenciosamente en el 401 (config
  // default) hasta que otra pantalla la vuelva a pedir por su cuenta.
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (token) initializeConfig();
  }, [token, initializeConfig]);

  useEffect(() => {
    const root = document.documentElement;
    
    // Apply colors
    Object.entries(config.theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // Apply typography
    root.style.setProperty('--font-family', config.theme.typography.fontFamily);
    root.style.setProperty('--font-size-base', `${config.theme.typography.baseSize}px`);
    root.style.setProperty('--heading-weight', `${config.theme.typography.headingWeight}`);
  }, [config.theme]);

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
