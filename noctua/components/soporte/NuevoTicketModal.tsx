'use client';

import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Send, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/hooks/lib/utils';
import { obtenerEstadoHorarioSoporte } from '@/lib/soporte/horarioAtencion';

import type {
  CreateTicketPayload,
  TicketCategoria,
} from '@/types/soporte';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    payload: CreateTicketPayload
  ) => Promise<boolean>;
  submitting: boolean;
}

type CategoriaOpcion = {
  value: TicketCategoria;
  label: string;
  emoji: string;
  desc: string;
};

const CATEGORIAS: CategoriaOpcion[] = [
  {
    value: 'bug',
    label: 'Bug',
    emoji: '🐛',
    desc: 'Algo no funciona',
  },
  {
    value: 'consulta',
    label: 'Consulta',
    emoji: '💬',
    desc: 'Tengo una pregunta',
  },
  {
    value: 'mejora',
    label: 'Mejora',
    emoji: '✨',
    desc: 'Sugerencia de mejora',
  },
  {
    value: 'urgente',
    label: 'Urgente',
    emoji: '🚨',
    desc: 'Necesita atención ya',
  },
];

const CATEGORIA_ACTIVE: Record<
  TicketCategoria,
  string
> = {
  bug: 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300',
  consulta:
    'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  mejora:
    'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  urgente:
    'border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300',
};

export function NuevoTicketModal({
  isOpen,
  onClose,
  onSubmit,
  submitting,
}: Props) {
  const [asunto, setAsunto] = useState('');

  const [categoria, setCategoria] =
    useState<TicketCategoria | null>(null);

  const [descripcion, setDescripcion] =
    useState('');

  const [errores, setErrores] = useState<
    Record<string, string>
  >({});

  /*
   * Obtiene el estado actual del horario de soporte
   * utilizando la zona horaria de Argentina.
   */
  const horarioSoporte =
    obtenerEstadoHorarioSoporte();

  /**
   * Comprueba que todos los campos sean válidos
   * antes de enviar el ticket.
   */
  const validar = (): boolean => {
    const nuevosErrores: Record<
      string,
      string
    > = {};

    const asuntoLimpio = asunto.trim();
    const descripcionLimpia =
      descripcion.trim();

    if (
      asuntoLimpio.length < 5 ||
      asuntoLimpio.length > 120
    ) {
      nuevosErrores.asunto =
        'El asunto es obligatorio y debe tener entre 5 y 120 caracteres';
    }

    if (!categoria) {
      nuevosErrores.categoria =
        'Seleccioná una categoría';
    }

    if (
      descripcionLimpia.length < 20 ||
      descripcionLimpia.length > 1000
    ) {
      nuevosErrores.descripcion =
        'La descripción debe tener entre 20 y 1000 caracteres';
    }

    setErrores(nuevosErrores);

    return (
      Object.keys(nuevosErrores).length ===
      0
    );
  };

  /**
   * Limpia todos los datos ingresados.
   */
  const limpiarFormulario = () => {
    setAsunto('');
    setCategoria(null);
    setDescripcion('');
    setErrores({});
  };

  /**
   * Envía el ticket después de validar
   * correctamente el formulario.
   */
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (submitting) return;

    if (!validar() || !categoria) {
      return;
    }

    const ok = await onSubmit({
      asunto: asunto.trim(),
      categoria,
      descripcion: descripcion.trim(),
    });

    if (ok) {
      limpiarFormulario();
      onClose();
    }
  };

  /**
   * Cierra el modal y limpia el formulario,
   * excepto mientras se está enviando.
   */
  const handleClose = () => {
    if (submitting) return;

    limpiarFormulario();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Fondo oscuro del modal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Contenedor principal */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo ticket de soporte"
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
              className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-float"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {/* Encabezado */}
              <div className="flex flex-shrink-0 items-center justify-between border-b border-line px-5 py-4 sm:px-6 sm:py-5">
                <div className="pr-4">
                  <h2 className="text-lg font-bold tracking-tight text-ink">
                    Nuevo ticket de soporte
                  </h2>

                  <p className="mt-0.5 text-xs text-ink-3">
                    Describí el problema o
                    consulta con el mayor detalle
                    posible.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  aria-label="Cerrar"
                  className="flex-shrink-0 rounded-lg p-1 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Formulario desplazable */}
              <form
                onSubmit={handleSubmit}
                className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6"
              >
                {/* Aviso fuera del horario */}
                {!horarioSoporte.abierto && (
                  <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle
                        size={18}
                        className="mt-0.5 flex-shrink-0 text-yellow-700 dark:text-yellow-400"
                      />

                      <div>
                        <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
                          Fuera del horario de
                          atención
                        </p>

                        <p className="mt-1 text-xs leading-relaxed text-ink-3">
                          Podés enviar el ticket
                          normalmente. Será
                          registrado ahora y
                          revisado a partir de{' '}
                          {horarioSoporte.proximaApertura
                            ? horarioSoporte.proximaApertura.toLowerCase()
                            : 'la próxima apertura'}
                          .
                        </p>

                        <p className="mt-2 text-[11px] text-ink-3">
                          Horario de Argentina
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Aviso dentro del horario */}
                {horarioSoporte.abierto && (
                  <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                      Soporte en línea
                    </p>

                    <p className="mt-1 text-xs text-ink-3">
                      Actualmente nos encontramos
                      dentro del horario de
                      atención.
                    </p>
                  </div>
                )}

                {/* Asunto */}
                <div>
                  <label
                    htmlFor="ticket-asunto"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-ink-3"
                  >
                    Asunto{' '}
                    <span className="font-normal normal-case tracking-normal text-ink-3">
                      ({asunto.length}/120)
                    </span>
                  </label>

                  <input
                    id="ticket-asunto"
                    type="text"
                    value={asunto}
                    maxLength={120}
                    disabled={submitting}
                    onChange={(event) => {
                      setAsunto(
                        event.target.value.slice(
                          0,
                          120
                        )
                      );

                      if (errores.asunto) {
                        setErrores(
                          (actuales) => ({
                            ...actuales,
                            asunto: '',
                          })
                        );
                      }
                    }}
                    placeholder="Ej: El módulo de stock no carga correctamente"
                    aria-invalid={
                      Boolean(errores.asunto)
                    }
                    aria-describedby={
                      errores.asunto
                        ? 'ticket-asunto-error'
                        : undefined
                    }
                    className={cn(
                      'w-full rounded-lg border bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 disabled:cursor-not-allowed disabled:opacity-60',
                      errores.asunto
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-line focus:border-line-strong'
                    )}
                  />

                  {errores.asunto && (
                    <p
                      id="ticket-asunto-error"
                      className="mt-1 text-xs text-red-700 dark:text-red-400"
                    >
                      {errores.asunto}
                    </p>
                  )}
                </div>

                {/* Categoría */}
                <div>
                  <p className="mb-2 block text-xs font-semibold uppercase tracking-widest text-ink-3">
                    Categoría
                  </p>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {CATEGORIAS.map(
                      (opcion) => (
                        <button
                          key={opcion.value}
                          type="button"
                          disabled={submitting}
                          onClick={() => {
                            setCategoria(
                              opcion.value
                            );

                            if (
                              errores.categoria
                            ) {
                              setErrores(
                                (actuales) => ({
                                  ...actuales,
                                  categoria: '',
                                })
                              );
                            }
                          }}
                          className={cn(
                            'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60',
                            categoria ===
                              opcion.value
                              ? CATEGORIA_ACTIVE[
                                  opcion.value
                                ]
                              : 'border-line bg-surface-2/50 text-ink-3 hover:border-line-strong hover:text-ink-2'
                          )}
                        >
                          <span className="text-lg leading-none">
                            {opcion.emoji}
                          </span>

                          <span>
                            <span className="block text-sm font-semibold leading-tight">
                              {opcion.label}
                            </span>

                            <span className="block text-[11px] opacity-60">
                              {opcion.desc}
                            </span>
                          </span>
                        </button>
                      )
                    )}
                  </div>

                  {errores.categoria && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                      {errores.categoria}
                    </p>
                  )}
                </div>

                {/* Descripción */}
                <div>
                  <label
                    htmlFor="ticket-descripcion"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-ink-3"
                  >
                    Descripción{' '}
                    <span className="font-normal normal-case tracking-normal text-ink-3">
                      ({descripcion.length}/1000)
                    </span>
                  </label>

                  <textarea
                    id="ticket-descripcion"
                    value={descripcion}
                    maxLength={1000}
                    disabled={submitting}
                    onChange={(event) => {
                      setDescripcion(
                        event.target.value.slice(
                          0,
                          1000
                        )
                      );

                      if (
                        errores.descripcion
                      ) {
                        setErrores(
                          (actuales) => ({
                            ...actuales,
                            descripcion: '',
                          })
                        );
                      }
                    }}
                    placeholder="Describí el problema con detalle: qué hiciste, qué esperabas y qué ocurrió..."
                    rows={5}
                    aria-invalid={Boolean(
                      errores.descripcion
                    )}
                    aria-describedby={
                      errores.descripcion
                        ? 'ticket-descripcion-error'
                        : undefined
                    }
                    className={cn(
                      'w-full resize-none rounded-lg border bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 disabled:cursor-not-allowed disabled:opacity-60',
                      errores.descripcion
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-line focus:border-line-strong'
                    )}
                  />

                  {errores.descripcion && (
                    <p
                      id="ticket-descripcion-error"
                      className="mt-1 text-xs text-red-700 dark:text-red-400"
                    >
                      {errores.descripcion}
                    </p>
                  )}
                </div>

                {/* Botones */}
                <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={handleClose}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    loading={submitting}
                    disabled={submitting}
                  >
                    <Send size={14} />
                    {submitting
                      ? 'Enviando...'
                      : 'Enviar ticket'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
