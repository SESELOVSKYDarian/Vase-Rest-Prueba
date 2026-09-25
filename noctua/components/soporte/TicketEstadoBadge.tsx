'use client';

import { cn } from '@/hooks/lib/utils';
import type { TicketEstado } from '@/types/soporte';

interface Props {
  estado: TicketEstado;
  className?: string;
}

const CONFIG: Record<TicketEstado, { label: string; className: string }> = {
  abierto:     { label: 'Abierto',      className: 'bg-yellow-400/10 text-yellow-700 dark:text-yellow-400 border-yellow-400/30' },
  en_revision: { label: 'En revisión',  className: 'bg-blue-400/10 text-blue-700 dark:text-blue-400 border-blue-400/30' },
  resuelto:    { label: 'Resuelto',     className: 'bg-green-400/10 text-green-700 dark:text-green-400 border-green-400/30' },
  cerrado:     { label: 'Cerrado',      className: 'bg-surface-2/10 text-ink-3 border-line-strong/30' },
};

export function TicketEstadoBadge({ estado, className }: Props) {
  const { label, className: stateClass } = CONFIG[estado];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border',
        stateClass,
        className
      )}
    >
      {label}
    </span>
  );
}
