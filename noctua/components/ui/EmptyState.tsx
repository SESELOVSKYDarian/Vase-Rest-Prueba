import type { ReactNode } from 'react';
import { EmptyCloche, EmptySearch } from '@/components/ui/Illustrations';

interface EmptyStateProps {
  title: string;
  /** Qué hacer a continuación: un estado vacío enseña, no solo avisa. */
  hint?: string;
  action?: ReactNode;
  variant?: 'empty' | 'search';
  className?: string;
}

export function EmptyState({ title, hint, action, variant = 'empty', className }: EmptyStateProps) {
  const Illustration = variant === 'search' ? EmptySearch : EmptyCloche;
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-14 animate-[fade_320ms_var(--ease-out)_both] ${className ?? ''}`}>
      <Illustration className="w-40 h-auto text-ink-3/70" />
      <p className="mt-5 text-ink font-medium">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-sm text-ink-3 text-pretty">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
