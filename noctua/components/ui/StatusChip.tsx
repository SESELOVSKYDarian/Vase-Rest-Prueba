import { CheckCircle2, AlertTriangle, Clock, XCircle, Info, CreditCard, Circle, AlertOctagon } from 'lucide-react';
import type { StatusTone } from '@/hooks/lib/statusTones';

// Tinte suave + texto con contraste AA en ambos modos + ícono: el estado nunca depende
// solo del color (accesibilidad).
const TONE_STYLES: Record<StatusTone, { className: string; Icon: typeof CheckCircle2 }> = {
  success: { className: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300', Icon: CheckCircle2 },
  warning: { className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300', Icon: AlertTriangle },
  caution: { className: 'bg-orange-500/12 text-orange-800 dark:text-orange-300', Icon: Clock },
  danger: { className: 'bg-red-500/12 text-red-800 dark:text-red-300', Icon: XCircle },
  info: { className: 'bg-sky-500/12 text-sky-800 dark:text-sky-300', Icon: Info },
  special: { className: 'bg-violet-500/12 text-violet-800 dark:text-violet-300', Icon: CreditCard },
  neutral: { className: 'bg-ink/[0.06] text-ink-2', Icon: Circle },
  critical: { className: 'bg-pink-500/12 text-pink-800 dark:text-pink-300', Icon: AlertOctagon },
};

interface StatusChipProps {
  tone: StatusTone;
  label: string;
  className?: string;
}

/** Chip de estado unificado: siempre ícono + color + texto, nunca color solo. */
export function StatusChip({ tone, label, className }: StatusChipProps) {
  const { className: toneClassName, Icon } = TONE_STYLES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${toneClassName} ${className ?? ''}`}>
      <Icon size={12} strokeWidth={2.2} />
      {label}
    </span>
  );
}
