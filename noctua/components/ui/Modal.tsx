'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/hooks/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, className, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      const prev = document.activeElement as HTMLElement;
      firstFocusRef.current?.focus();
      return () => prev?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-scrim backdrop-blur-[2px] z-50"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* En mobile entra como hoja desde abajo (al alcance del pulgar); en desktop, centrado. */}
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
            <motion.div
              initial={{ opacity: 0, transform: 'translateY(24px) scale(0.98)' }}
              animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
              exit={{ opacity: 0, transform: 'translateY(16px) scale(0.98)', transition: { duration: 0.16 } }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              className={cn(
                'relative w-full max-h-[92dvh] overflow-y-auto bg-surface border border-line rounded-t-2xl sm:rounded-2xl shadow-float',
                sizes[size],
                className
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-surface px-6 pt-5 pb-3">
                <h2 className="text-ink font-semibold text-lg tracking-tight">{title}</h2>
                <button
                  ref={firstFocusRef}
                  onClick={onClose}
                  aria-label="Cerrar modal"
                  className="pressable -mr-2 grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>
              {/* Body */}
              <div className="px-6 pb-6 pt-1">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
