'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  dangerMessage?: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar eliminación',
  message = '¿Estás seguro de que querés eliminar este ítem?',
  dangerMessage,
  confirmLabel = 'Eliminar',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-[#BCB9B9] text-sm leading-relaxed">{message}</p>
        {dangerMessage && (
          <p className="text-red-400 text-xs leading-relaxed bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {dangerMessage}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="flex-1">Cancelar</Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} className="flex-1">{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
