import { CheckCircle2, AlertTriangle, Clock, XCircle, Info, CreditCard, Circle, AlertOctagon } from 'lucide-react';
import type { StatusTone } from '@/hooks/lib/statusTones';

const TONE_STYLES: Record<StatusTone, { className: string; Icon: typeof CheckCircle2 }> = {
  success: { className: 'bg-green-500/20 text-green-400 border-green-500/30', Icon: CheckCircle2 },
  warning: { className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', Icon: AlertTriangle },
  caution: { className: 'bg-orange-500/20 text-orange-400 border-orange-500/30', Icon: Clock },
  danger: { className: 'bg-red-500/20 text-red-400 border-red-500/30', Icon: XCircle },
  info: { className: 'bg-blue-500/20 text-blue-400 border-blue-500/30', Icon: Info },
  special: { className: 'bg-purple-500/20 text-purple-400 border-purple-500/30', Icon: CreditCard },
  neutral: { className: 'bg-gray-500/20 text-gray-400 border-gray-500/30', Icon: Circle },
  critical: { className: 'bg-pink-500/20 text-pink-400 border-pink-500/30', Icon: AlertOctagon },
};

interface StatusChipProps {
  tone: StatusTone;
  label: string;
  className?: string;
}

/** Chip de estado unificado: siempre ícono + color + texto, nunca color solo (accesibilidad). */
export function StatusChip({ tone, label, className }: StatusChipProps) {
  const { className: toneClassName, Icon } = TONE_STYLES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide ${toneClassName} ${className ?? ''}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}
