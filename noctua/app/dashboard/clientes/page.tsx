'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Users } from 'lucide-react';
import { ClienteFormModal } from '@/components/clientes/ClienteFormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { clientesService } from '@/services/clientesService';
import type { Cliente, ClienteInput } from '@/types/cliente';

export default function ClientesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState<Cliente | undefined>();
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | undefined>();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const clientesQuery = useQuery({
    queryKey: ['clientes'],
    queryFn: clientesService.getClientes,
  });

  const invalidateClientes = () => queryClient.invalidateQueries({ queryKey: ['clientes'] });

  const saveMutation = useMutation({
    mutationFn: (input: ClienteInput) => {
      if (clienteToEdit) return clientesService.updateCliente(clienteToEdit.id, input);
      return clientesService.createCliente(input);
    },
    onSuccess: async () => {
      setMutationError(null);
      setIsFormOpen(false);
      setClienteToEdit(undefined);
      await invalidateClientes();
    },
    onError: (error) => {
      setMutationError(error instanceof Error ? error.message : 'No se pudo guardar el cliente.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientesService.deleteCliente(id),
    onSuccess: async () => {
      setMutationError(null);
      setClienteToDelete(undefined);
      await invalidateClientes();
    },
    onError: (error) => {
      setMutationError(error instanceof Error ? error.message : 'No se pudo eliminar el cliente.');
    },
  });

  const clientes = clientesQuery.data ?? [];

  const filteredClientes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return clientes;
    return clientes.filter((cliente) =>
      cliente.nombre.toLowerCase().includes(query) ||
      (cliente.telefono ?? '').toLowerCase().includes(query) ||
      (cliente.email ?? '').toLowerCase().includes(query) ||
      (cliente.documento ?? '').toLowerCase().includes(query)
    );
  }, [clientes, searchQuery]);

  const openCreate = () => {
    setMutationError(null);
    setClienteToEdit(undefined);
    setIsFormOpen(true);
  };

  const openEdit = (cliente: Cliente) => {
    setMutationError(null);
    setClienteToEdit(cliente);
    setIsFormOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Clientes</h1>
          <p className="text-[#676b67]">Base de clientes reales, usada por Reservas, Pedidos y Facturas.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 flex items-center gap-2"
        >
          <Plus size={16} />
          Nuevo cliente
        </button>
      </div>

      {(mutationError || clientesQuery.error) && (
        <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          {mutationError || (clientesQuery.error instanceof Error ? clientesQuery.error.message : null)}
        </div>
      )}

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#676b67]" size={18} />
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono, email o documento..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full bg-[#151515] border border-[#252525] rounded-lg pl-10 pr-4 py-2 text-white"
        />
      </div>

      {clientesQuery.isLoading ? (
        <p className="text-[#676b67] text-center py-12">Cargando clientes reales...</p>
      ) : filteredClientes.length === 0 ? (
        <div className="text-center py-16">
          <Users size={32} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-[#676b67]">
            {clientes.length === 0 ? 'Todavía no hay clientes cargados.' : 'No se encontraron clientes con ese criterio.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#101010] border border-[#252525] rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="text-[#676b67] text-xs uppercase border-b border-[#252525] bg-[#0d0d0d]">
              <tr>
                <th className="px-6 py-3">Nombre</th>
                <th className="px-6 py-3">Teléfono</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Documento</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252525]">
              {filteredClientes.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-[#0d0d0d]">
                  <td className="px-6 py-4 text-white font-medium">{cliente.nombre}</td>
                  <td className="px-6 py-4 text-[#676b67]">{cliente.telefono || '-'}</td>
                  <td className="px-6 py-4 text-[#676b67]">{cliente.email || '-'}</td>
                  <td className="px-6 py-4 text-[#676b67]">{cliente.documento || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEdit(cliente)}
                      className="mr-3 text-[#676b67] hover:text-white"
                      aria-label={`Editar ${cliente.nombre}`}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setClienteToDelete(cliente)}
                      className="text-red-400 hover:text-red-300"
                      aria-label={`Eliminar ${cliente.nombre}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClienteFormModal
        key={`${isFormOpen ? 'open' : 'closed'}-${clienteToEdit?.id || 'new'}`}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setClienteToEdit(undefined);
        }}
        onSubmit={(input) => saveMutation.mutate(input)}
        isSaving={saveMutation.isPending}
        clienteToEdit={clienteToEdit}
      />

      <ConfirmDialog
        isOpen={!!clienteToDelete}
        onClose={() => setClienteToDelete(undefined)}
        onConfirm={() => {
          if (clienteToDelete) deleteMutation.mutate(clienteToDelete.id);
        }}
        title={`Eliminar "${clienteToDelete?.nombre || ''}"`}
        message="Se eliminará el cliente. Sus reservas, pedidos y facturas anteriores se conservan, solo quedan sin cliente asociado."
      />
    </div>
  );
}
