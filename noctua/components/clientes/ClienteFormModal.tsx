'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Cliente, ClienteInput } from '@/types/cliente';

interface ClienteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: ClienteInput) => void;
  isSaving?: boolean;
  clienteToEdit?: Cliente;
}

export function ClienteFormModal({ isOpen, onClose, onSubmit, isSaving, clienteToEdit }: ClienteFormModalProps) {
  const [nombre, setNombre] = useState(() => clienteToEdit?.nombre || '');
  const [telefono, setTelefono] = useState(() => clienteToEdit?.telefono || '');
  const [email, setEmail] = useState(() => clienteToEdit?.email || '');
  const [documento, setDocumento] = useState(() => clienteToEdit?.documento || '');
  const [observaciones, setObservaciones] = useState(() => clienteToEdit?.observaciones || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ nombre, telefono, email, documento, observaciones });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={clienteToEdit ? 'Editar cliente' : 'Nuevo cliente'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-ink text-sm font-medium mb-1 block">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            autoFocus
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink"
            placeholder="Nombre y apellido"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-ink text-sm font-medium mb-1 block">Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="text-ink text-sm font-medium mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink"
              placeholder="Opcional"
            />
          </div>
        </div>

        <div>
          <label className="text-ink text-sm font-medium mb-1 block">Documento</label>
          <input
            type="text"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink"
            placeholder="DNI / CUIT (opcional)"
          />
        </div>

        <div>
          <label className="text-ink text-sm font-medium mb-1 block">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2 text-ink h-20"
            placeholder="Notas internas (opcional)"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" loading={isSaving} disabled={!nombre.trim()} className="flex-1">
            {clienteToEdit ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
