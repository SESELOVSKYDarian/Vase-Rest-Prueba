'use client';

import { cn } from '@/hooks/lib/utils';

interface BadgeProps {
  color?: string;
  label: string;
  className?: string;
}

export function Badge({ color = 'bg-surface-2', label, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold tracking-wide text-ink',
        color,
        className
      )}
    >
      {label}
    </span>
  );
}

interface DotBadgeProps {
  color?: string;
  label: string;
  className?: string;
}

export function DotBadge({ color = 'bg-surface-2', label, className }: DotBadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-ink-2', className)}>
      <span className={cn('w-2 h-2 rounded-full', color)} />
      {label}
    </span>
  );
}
