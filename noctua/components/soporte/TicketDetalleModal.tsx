'use client';

import { useState } from 'react';
import {
  AnimatePresence,
  motion,
} from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/hooks/lib/utils';

import {
  TicketCategoriaBadge,
  getCategoriaBorderColor,
} from './TicketCategoriaBadge';
import { TicketEstadoBadge } from './TicketEstadoBadge';

import type {
  TicketEstado,
  TicketSoporte,
} from '@/types/soporte';

interface Props {
  ticket: TicketSoporte | null;
  isOpen: boolean;

  /**
   * Esta propiedad controla el panel
   * utilizado por el desarrollador.
   *
   * Se mantiene el nombre isAdmin para no
   * romper las llamadas realizadas desde
   * TicketListView.
   */
  isAdmin: boolean;

  /**
   * Indica si el administrador propietario
   * puede eliminar el ticket.
   */
  canDelete: boolean;

  onClose: () => void;

  onActualizarEstado: (
    id: string,
    estado: TicketEstado,
    respuesta?: string
  ) => Promise<void>;

  onEliminar: (
    id: string
  ) => Promise<boolean>;
}

const ESTADOS_ORDEN: TicketEstado[] = [
  'abierto',
  'en_revision',
  'resuelto',
  'cerrado',
];

const ESTADO_LABEL: Record<
  TicketEstado,
  string
> = {
  abierto: 'Abierto',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};

/**
 * Formatea las fechas usando la hora
 * de Argentina.
 */
function formatFecha(
  fechaIso: string
): string {
  return new Date(
    fechaIso
  ).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone:
      'America/Argentina/Buenos_Aires',
  });
}

export function TicketDetalleModal({
  ticket,
  isOpen,
  isAdmin,
  canDelete,
  onClose,
  onActualizarEstado,
  onEliminar,
}: Props) {
  const [
    estadoSeleccionado,
    setEstadoSeleccionado,
  ] = useState<TicketEstado | null>(
    null
  );

  const [respuesta, setRespuesta] =
    useState('');

  const [guardando, setGuardando] =
    useState(false);

  const [
    confirmandoEliminar,
    setConfirmandoEliminar,
  ] = useState(false);

  const [eliminando, setEliminando] =
    useState(false);

  /**
   * Reinicia todos los estados internos
   * utilizados por el modal.
   */
  const reiniciarEstadoLocal = () => {
    setEstadoSeleccionado(null);
    setRespuesta('');
    setConfirmandoEliminar(false);
    setGuardando(false);
    setEliminando(false);
  };

  if (!ticket) {
    return null;
  }

  const estadoActivo =
    estadoSeleccionado ??
    ticket.estado;

  const borderColor =
    getCategoriaBorderColor(
      ticket.categoria
    );

  const respuestaExistente =
    ticket.respuesta_interna?.trim() ??
    '';

  const respuestaNueva =
    respuesta.trim();

  const respuestaDisponible =
    respuestaNueva ||
    respuestaExistente;

  const estadoRequiereRespuesta =
    estadoActivo === 'resuelto' ||
    estadoActivo === 'cerrado';

  const puedeGuardar =
    Boolean(estadoSeleccionado) &&
    !guardando &&
    !eliminando &&
    !(
      estadoRequiereRespuesta &&
      !respuestaDisponible
    );

  /**
   * Cierra el modal y limpia su estado.
   *
   * No permite cerrar mientras se está
   * guardando o eliminando información.
   */
  const handleClose = () => {
    if (guardando || eliminando) {
      return;
    }

    reiniciarEstadoLocal();
    onClose();
  };

  /**
   * Guarda el nuevo estado y la respuesta
   * escrita por el desarrollador.
   */
  const handleGuardar =
    async () => {
      if (
        !estadoSeleccionado ||
        !puedeGuardar
      ) {
        return;
      }

      try {
        setGuardando(true);

        await onActualizarEstado(
          ticket.id,
          estadoSeleccionado,
          respuestaNueva ||
            undefined
        );

        reiniciarEstadoLocal();
        onClose();
      } finally {
        setGuardando(false);
      }
    };

  /**
   * Elimina el ticket después de recibir
   * la confirmación del administrador.
   */
  const handleEliminar =
    async () => {
      if (
        !canDelete ||
        eliminando
      ) {
        return;
      }

      try {
        setEliminando(true);

        const eliminado =
          await onEliminar(ticket.id);

        if (eliminado) {
          reiniciarEstadoLocal();
          onClose();
        }
      } finally {
        setEliminando(false);
      }
    };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Fondo del modal */}
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: 0.15,
            }}
            className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Contenedor del modal */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Ticket: ${ticket.asunto}`}
          >
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.96,
                y: 16,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
                y: 16,
              }}
              transition={{
                duration: 0.2,
                ease: 'easeOut',
              }}
              className={cn(
                'relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-l-4 border-line bg-surface shadow-float',
                borderColor
              )}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {/* Encabezado */}
              <div className="flex flex-shrink-0 items-start justify-between border-b border-line px-5 py-5 sm:px-6">
                <div className="flex-1 pr-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <TicketCategoriaBadge
                      categoria={
                        ticket.categoria
                      }
                    />

                    <TicketEstadoBadge
                      estado={
                        ticket.estado
                      }
                    />
                  </div>

                  <h2 className="text-lg font-bold leading-snug text-ink">
                    {ticket.asunto}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  disabled={
                    guardando ||
                    eliminando
                  }
                  aria-label="Cerrar"
                  className="flex-shrink-0 rounded-lg p-1 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Contenido desplazable */}
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                {/* Datos del ticket */}
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  {ticket.nombre_usuario && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-ink-3">
                        Usuario
                      </p>

                      <p className="text-ink-2">
                        {
                          ticket.nombre_usuario
                        }{' '}

                        <span className="text-xs capitalize text-ink-3">
                          (
                          {
                            ticket.rol_usuario
                          }
                          )
                        </span>
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-ink-3">
                      Creado
                    </p>

                    <p className="text-ink-2">
                      {formatFecha(
                        ticket.creado_en
                      )}
                    </p>
                  </div>

                  {ticket.resuelto_en && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-ink-3">
                        Resuelto
                      </p>

                      <p className="text-ink-2">
                        {formatFecha(
                          ticket.resuelto_en
                        )}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-ink-3">
                      ID
                    </p>

                    <p className="truncate font-mono text-xs text-ink-3">
                      {ticket.id}
                    </p>
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-3">
                    Descripción
                  </p>

                  <div className="rounded-lg border border-line bg-surface-2 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
                      {
                        ticket.descripcion
                      }
                    </p>
                  </div>
                </div>

                {/* Respuesta del equipo */}
                {ticket.respuesta_interna && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-3">
                      Respuesta del equipo
                    </p>

                    <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-green-700 dark:text-green-300">
                        {
                          ticket.respuesta_interna
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Estado visual */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-3">
                    Estado del ticket
                  </p>

                  <div className="flex items-center">
                    {ESTADOS_ORDEN.map(
                      (
                        estado,
                        indice
                      ) => {
                        const indiceActual =
                          ESTADOS_ORDEN.indexOf(
                            ticket.estado
                          );

                        const completado =
                          indice <=
                          indiceActual;

                        return (
                          <div
                            key={
                              estado
                            }
                            className="flex flex-1 items-center last:flex-none"
                          >
                            <div
                              className={cn(
                                'flex flex-col items-center gap-1',

                                indice <
                                  ESTADOS_ORDEN.length -
                                    1 &&
                                  'flex-1'
                              )}
                            >
                              <div
                                className={cn(
                                  'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',

                                  completado
                                    ? 'border-brand bg-brand'
                                    : 'border-line bg-surface-2'
                                )}
                              >
                                {completado ? (
                                  <CheckCircle2
                                    size={
                                      12
                                    }
                                    className="text-on-brand"
                                  />
                                ) : (
                                  <Clock
                                    size={
                                      10
                                    }
                                    className="text-ink-3"
                                  />
                                )}
                              </div>

                              <span
                                className={cn(
                                  'whitespace-nowrap text-center text-[9px] font-semibold uppercase tracking-wider',

                                  completado
                                    ? 'text-ink-2'
                                    : 'text-ink-3'
                                )}
                              >
                                {
                                  ESTADO_LABEL[
                                    estado
                                  ]
                                }
                              </span>
                            </div>

                            {indice <
                              ESTADOS_ORDEN.length -
                                1 && (
                              <div
                                className={cn(
                                  'mx-1 mb-4 h-px flex-1 transition-all',

                                  completado &&
                                    indice <
                                      indiceActual
                                    ? 'bg-white'
                                    : 'bg-surface-3'
                                )}
                              />
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Panel del desarrollador */}
                {isAdmin && (
                  <div className="space-y-4 rounded-xl border border-line bg-surface-2/40 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink-3">
                      <AlertCircle
                        size={12}
                      />

                      Panel del desarrollador
                    </p>

                    {/* Selección de estado */}
                    <div>
                      <p className="mb-2 text-xs font-semibold text-ink-3">
                        Cambiar estado
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {ESTADOS_ORDEN.map(
                          (estado) => (
                            <button
                              key={
                                estado
                              }
                              type="button"
                              disabled={
                                guardando ||
                                eliminando
                              }
                              onClick={() =>
                                setEstadoSeleccionado(
                                  estado
                                )
                              }
                              className={cn(
                                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50',

                                estadoActivo ===
                                  estado
                                  ? 'border-brand bg-brand text-on-brand'
                                  : 'border-line text-ink-3 hover:border-line-strong hover:text-ink-2'
                              )}
                            >
                              {
                                ESTADO_LABEL[
                                  estado
                                ]
                              }
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Respuesta */}
                    <div>
                      <label
                        htmlFor="respuesta-ticket"
                        className="mb-1.5 block text-xs font-semibold text-ink-3"
                      >
                        Respuesta para el usuario
                      </label>

                      <textarea
                        id="respuesta-ticket"
                        value={respuesta}
                        onChange={(event) =>
                          setRespuesta(
                            event.target.value
                          )
                        }
                        disabled={
                          guardando ||
                          eliminando
                        }
                        placeholder={
                          respuestaExistente
                            ? 'Escribí una nueva respuesta solamente si querés reemplazar la anterior...'
                            : 'Escribí la solución o respuesta para el usuario...'
                        }
                        rows={4}
                        className="w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-line-strong disabled:cursor-not-allowed disabled:opacity-50"
                      />

                      {estadoRequiereRespuesta &&
                        !respuestaDisponible && (
                          <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">
                            Para resolver o cerrar
                            el ticket debés escribir
                            una respuesta.
                          </p>
                        )}
                    </div>

                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={
                        handleGuardar
                      }
                      loading={guardando}
                      disabled={
                        !puedeGuardar
                      }
                    >
                      Guardar cambios
                    </Button>
                  </div>
                )}

                {/* Mensaje para el administrador */}
                {!isAdmin &&
                  !ticket.respuesta_interna && (
                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-center">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Nuestro equipo está
                        revisando tu solicitud.
                      </p>

                      <p className="mt-1 text-xs text-ink-3">
                        La respuesta aparecerá en
                        este espacio cuando esté
                        disponible.
                      </p>
                    </div>
                  )}

                {/* Eliminación del ticket */}
                {canDelete && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                    {!confirmandoEliminar ? (
                      <>
                        <div className="mb-3 flex items-start gap-3">
                          <Trash2
                            size={18}
                            className="mt-0.5 flex-shrink-0 text-red-700 dark:text-red-400"
                          />

                          <div>
                            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                              Eliminar ticket
                              respondido
                            </p>

                            <p className="mt-1 text-xs leading-relaxed text-ink-3">
                              El ticket ya fue
                              respondido y puede
                              eliminarse del listado.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setConfirmandoEliminar(
                              true
                            )
                          }
                          disabled={
                            eliminando ||
                            guardando
                          }
                          className="w-full rounded-lg border border-red-500/40 px-4 py-2.5 text-sm font-semibold text-red-700 dark:text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Eliminar ticket
                        </button>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                            ¿Confirmar eliminación?
                          </p>

                          <p className="mt-1 text-xs leading-relaxed text-ink-3">
                            El ticket desaparecerá
                            del listado. Esta acción
                            no puede deshacerse.
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            disabled={
                              eliminando
                            }
                            onClick={() =>
                              setConfirmandoEliminar(
                                false
                              )
                            }
                            className="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancelar
                          </button>

                          <button
                            type="button"
                            disabled={
                              eliminando
                            }
                            onClick={() => {
                              void handleEliminar();
                            }}
                            className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {eliminando
                              ? 'Eliminando...'
                              : 'Sí, eliminar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
