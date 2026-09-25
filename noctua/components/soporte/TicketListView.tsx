'use client';

import { useMemo, useState } from 'react';
import {
  Inbox,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/hooks/lib/utils';

import { NuevoTicketModal } from './NuevoTicketModal';
import { TicketCard } from './TicketCard';
import { TicketDetalleModal } from './TicketDetalleModal';

import type {
  CreateTicketPayload,
  TicketCategoria,
  TicketEstado,
  TicketSoporte,
} from '@/types/soporte';

interface Props {
  tickets: TicketSoporte[];
  loading: boolean;
  error: string | null;
  submitting: boolean;

  isAdmin: boolean;
  isDeveloper: boolean;

  onCrearTicket: (
    payload: CreateTicketPayload
  ) => Promise<boolean>;

  onActualizarEstado: (
    id: string,
    estado: TicketEstado,
    respuesta?: string
  ) => Promise<void>;

  onEliminarTicket: (
    id: string
  ) => Promise<boolean>;

  onRefetch: () => void;
}

const FILTROS_ESTADO: {
  value: TicketEstado | 'todos';
  label: string;
}[] = [
  {
    value: 'todos',
    label: 'Todos',
  },
  {
    value: 'abierto',
    label: 'Abiertos',
  },
  {
    value: 'en_revision',
    label: 'En revisión',
  },
  {
    value: 'resuelto',
    label: 'Resueltos',
  },
  {
    value: 'cerrado',
    label: 'Cerrados',
  },
];

const FILTROS_CATEGORIA: {
  value: TicketCategoria | 'todas';
  label: string;
}[] = [
  {
    value: 'todas',
    label: 'Todas',
  },
  {
    value: 'bug',
    label: '🐛 Bug',
  },
  {
    value: 'consulta',
    label: '💬 Consulta',
  },
  {
    value: 'mejora',
    label: '✨ Mejora',
  },
  {
    value: 'urgente',
    label: '🚨 Urgente',
  },
];

/**
 * Tarjeta temporal que se muestra
 * mientras se cargan los tickets.
 */
function TicketSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-line bg-surface-2 p-5">
      <div className="mb-3 flex gap-2">
        <div className="h-5 w-16 rounded-full bg-surface-3" />
        <div className="h-5 w-16 rounded-full bg-surface-3" />
      </div>

      <div className="mb-2 h-4 w-3/4 rounded bg-surface-3" />
      <div className="mb-1 h-3 w-full rounded bg-surface-3" />
      <div className="mb-4 h-3 w-2/3 rounded bg-surface-3" />
      <div className="h-3 w-1/3 rounded bg-surface-3" />
    </div>
  );
}

export function TicketListView({
  tickets,
  loading,
  error,
  submitting,
  isAdmin,
  isDeveloper,
  onCrearTicket,
  onActualizarEstado,
  onEliminarTicket,
  onRefetch,
}: Props) {
  const [
    modalNuevoOpen,
    setModalNuevoOpen,
  ] = useState(false);

  const [
    ticketDetalle,
    setTicketDetalle,
  ] = useState<TicketSoporte | null>(
    null
  );

  const [
    filtroEstado,
    setFiltroEstado,
  ] = useState<
    TicketEstado | 'todos'
  >('todos');

  const [
    filtroCategoria,
    setFiltroCategoria,
  ] = useState<
    TicketCategoria | 'todas'
  >('todas');

  const [busqueda, setBusqueda] =
    useState('');

  /**
   * Aplica los filtros seleccionados
   * sobre el listado de tickets.
   */
  const ticketsFiltrados = useMemo(() => {
    const busquedaNormalizada =
      busqueda.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const coincideEstado =
        filtroEstado === 'todos' ||
        ticket.estado === filtroEstado;

      const coincideCategoria =
        filtroCategoria === 'todas' ||
        ticket.categoria ===
          filtroCategoria;

      const coincideBusqueda =
        busquedaNormalizada === '' ||
        ticket.asunto
          .toLowerCase()
          .includes(
            busquedaNormalizada
          ) ||
        ticket.descripcion
          .toLowerCase()
          .includes(
            busquedaNormalizada
          );

      return (
        coincideEstado &&
        coincideCategoria &&
        coincideBusqueda
      );
    });
  }, [
    tickets,
    filtroEstado,
    filtroCategoria,
    busqueda,
  ]);

  const cantidadAbiertos =
    tickets.filter(
      (ticket) =>
        ticket.estado === 'abierto'
    ).length;

  /**
   * El administrador solamente puede
   * eliminar sus tickets respondidos.
   */
  const puedeEliminarTicket =
    Boolean(
      isAdmin &&
        ticketDetalle &&
        ticketDetalle.respuesta_interna?.trim() &&
        (
          ticketDetalle.estado ===
            'resuelto' ||
          ticketDetalle.estado ===
            'cerrado'
        )
    );

  return (
    <div className="space-y-5">
      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
          />

          <input
            type="text"
            value={busqueda}
            onChange={(event) =>
              setBusqueda(
                event.target.value
              )
            }
            placeholder="Buscar por asunto o descripción..."
            className="w-full rounded-lg border border-line bg-surface-2 py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-line-strong"
          />
        </div>

        <button
          type="button"
          onClick={onRefetch}
          disabled={loading}
          aria-label="Recargar tickets"
          className="rounded-lg border border-line p-2 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={cn(
              loading &&
                'animate-spin'
            )}
          />
        </button>

        {/* Solo el administrador crea tickets */}
        {isAdmin && (
          <Button
            variant="primary"
            onClick={() =>
              setModalNuevoOpen(true)
            }
          >
            <Plus size={14} />
            Nuevo ticket
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTROS_ESTADO.map(
          (filtro) => (
            <button
              key={filtro.value}
              type="button"
              onClick={() =>
                setFiltroEstado(
                  filtro.value
                )
              }
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',

                filtroEstado ===
                  filtro.value
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-line text-ink-3 hover:border-line-strong hover:text-ink-2'
              )}
            >
              {filtro.label}
            </button>
          )
        )}

        <div className="mx-1 hidden w-px bg-surface-3 sm:block" />

        {FILTROS_CATEGORIA.map(
          (filtro) => (
            <button
              key={filtro.value}
              type="button"
              onClick={() =>
                setFiltroCategoria(
                  filtro.value
                )
              }
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',

                filtroCategoria ===
                  filtro.value
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-line text-ink-3 hover:border-line-strong hover:text-ink-2'
              )}
            >
              {filtro.label}
            </button>
          )
        )}
      </div>

      {/* Contador */}
      {!loading && (
        <p className="text-sm text-ink-3">
          {cantidadAbiertos > 0 ? (
            <>
              <span className="font-semibold text-yellow-700 dark:text-yellow-400">
                {cantidadAbiertos}
              </span>{' '}
              ticket
              {cantidadAbiertos !== 1
                ? 's'
                : ''}{' '}
              abierto
              {cantidadAbiertos !== 1
                ? 's'
                : ''}
            </>
          ) : (
            'Sin tickets abiertos'
          )}

          {ticketsFiltrados.length !==
            tickets.length && (
            <span className="ml-1 text-ink-3">
              ·{' '}
              {
                ticketsFiltrados.length
              }{' '}
              mostrado
              {ticketsFiltrados.length !==
              1
                ? 's'
                : ''}
            </span>
          )}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Lista de tickets */}
      <div className="space-y-3">
        {loading ? (
          <>
            <TicketSkeleton />
            <TicketSkeleton />
            <TicketSkeleton />
          </>
        ) : ticketsFiltrados.length >
          0 ? (
          ticketsFiltrados.map(
            (ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                /*
                 * TicketCard usa la propiedad
                 * isAdmin para mostrar el autor.
                 * Esa información debe verla
                 * el desarrollador.
                 */
                isAdmin={
                  isDeveloper
                }
                onClick={
                  setTicketDetalle
                }
              />
            )
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox
              size={40}
              className="mb-4 text-ink-3"
            />

            <p className="font-medium text-ink-3">
              {tickets.length === 0
                ? isDeveloper
                  ? 'No hay tickets de soporte pendientes.'
                  : 'No tenés tickets de soporte.'
                : 'No hay tickets que coincidan con los filtros.'}
            </p>
          </div>
        )}
      </div>

      {/* Modal para crear tickets */}
      {isAdmin && (
        <NuevoTicketModal
          isOpen={modalNuevoOpen}
          onClose={() =>
            setModalNuevoOpen(false)
          }
          onSubmit={onCrearTicket}
          submitting={submitting}
        />
      )}

      {/* Modal de detalle */}
      <TicketDetalleModal
        ticket={ticketDetalle}
        isOpen={Boolean(
          ticketDetalle
        )}
        /*
         * En TicketDetalleModal, isAdmin
         * controla el panel de respuesta.
         * Por eso recibe isDeveloper.
         */
        isAdmin={isDeveloper}
        onClose={() =>
          setTicketDetalle(null)
        }
        onActualizarEstado={async (
          id,
          estado,
          respuesta
        ) => {
          await onActualizarEstado(
            id,
            estado,
            respuesta
          );

          setTicketDetalle(null);
        }}
        canDelete={
          puedeEliminarTicket
        }
        onEliminar={async (id) => {
          const eliminado =
            await onEliminarTicket(id);

          if (eliminado) {
            setTicketDetalle(null);
          }

          return eliminado;
        }}
      />
    </div>
  );
}
