'use client';

import { useId } from 'react';
import { useThemeStore } from '@/store/themeStore';

// Sol que se vuelve luna: el disco crece, un círculo de máscara entra desde arriba a la
// derecha y "muerde" la luna, y los rayos giran y se recogen. Acción poco frecuente:
// acá sí hay presupuesto para un detalle de deleite (400ms, ease-out fuerte).
export function ThemeToggle({ className }: { className?: string }) {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  const maskId = useId();
  const dark = mode === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={dark ? 'Modo claro' : 'Modo oscuro'}
      data-mode={mode}
      className={`theme-toggle pressable grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:text-ink hover:bg-ink/[0.05] ${className ?? ''}`}
    >
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" aria-hidden="true">
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          <circle className="theme-toggle__cut" cx="12" cy="12" r="6" fill="black" />
        </mask>
        <circle className="theme-toggle__core" cx="12" cy="12" r="4.6" fill="currentColor" mask={`url(#${maskId})`} />
        <g className="theme-toggle__rays" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </g>
      </svg>
    </button>
  );
}
