'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/hooks/lib/utils';

interface KPICardProps {
  label: string;
  value: string;
  comparison?: number;
  icon: LucideIcon;
  loading?: boolean;
  empty?: boolean;
}

export function KPICard({
  label,
  value,
  comparison = 0,
  icon: Icon,
  loading,
  empty,
}: KPICardProps) {
  const isPositive = comparison > 0;
  const isNegative = comparison < 0;
  const ComparisonIcon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : ArrowRight;

  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 animate-pulse">
        <div className="h-4 w-24 rounded bg-surface-3" />
        <div className="mt-4 h-8 w-32 rounded bg-surface-3" />
        <div className="mt-3 h-5 w-20 rounded bg-surface-3" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-brand/25">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">{label}</p>
        <Icon size={18} className="text-ink-3" />
      </div>
      <p className="mt-6 text-3xl font-bold tracking-tight text-ink">{empty ? '-' : value}</p>
      <div
        className={cn(
          'mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
          isPositive && 'bg-green-500/10 text-green-700 dark:text-green-400',
          isNegative && 'bg-red-500/10 text-red-700 dark:text-red-400',
          !isPositive && !isNegative && 'bg-ink/5 text-ink-3'
        )}
      >
        <ComparisonIcon size={13} />
        {Math.abs(comparison).toFixed(1)}% vs período anterior
      </div>
    </div>
  );
}
