'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/hooks/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

// Jerarquía clara: un solo primario por vista (acento de marca), secundario con borde,
// ghost para acciones de menor peso. Todos responden al press (scale 0.97).
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    const base = 'pressable inline-flex items-center justify-center gap-2 font-medium select-none whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed';

    const variants = {
      primary: 'bg-brand text-on-brand hover:bg-brand-strong shadow-soft',
      secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2 shadow-soft',
      ghost: 'text-ink-2 hover:text-ink hover:bg-ink/[0.05]',
      danger: 'bg-red-600 text-white hover:bg-red-700 shadow-soft',
      success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-soft',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs rounded-lg',
      md: 'h-10 px-4 text-sm rounded-xl',
      lg: 'h-12 px-6 text-base rounded-xl',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
