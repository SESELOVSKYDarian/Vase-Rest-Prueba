'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp } from 'lucide-react';
import { TEXTO_ESTADO_MESA } from '@/hooks/lib/constants';
import { MESA_ESTADO_HEX } from '@/components/mesas/mesaEstadoColors';
import type { EstadoMesa, Mesa } from '@/types/mesa';

const ESTADOS_LEYENDA: EstadoMesa[] = [
  'libre',
  'ocupada',
  'esperando_pedido',
  'pedido_listo',
  'esperando_pago',
  'problema',
  'para_cobrar',
];

function Dot({ estado }: { estado: EstadoMesa }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: MESA_ESTADO_HEX[estado] }}
    />
  );
}

interface MesaStatusLegendProps {
  mesas?: Mesa[];
}

/** Leyenda colapsable centrada en la parte inferior, sin cubrir el plano. */
export function MesaStatusLegend({ mesas = [] }: MesaStatusLegendProps) {
  const [open, setOpen] = useState(false);

  const counts = ESTADOS_LEYENDA.reduce((acc, estado) => {
    acc[estado] = mesas.filter((mesa) => mesa.estado === estado).length;
    return acc;
  }, {} as Record<EstadoMesa, number>);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.13 }}
            className="pointer-events-auto bg-canvas/95 border border-line/60 rounded-2xl px-5 py-3 shadow-float backdrop-blur-sm mb-0.5"
          >
            <div className="grid grid-cols-4 gap-x-6 gap-y-1.5 min-w-max">
              {ESTADOS_LEYENDA.map((estado) => (
                <div key={estado} className="flex items-center gap-1.5">
                  <Dot estado={estado} />
                  <span className="text-[11px] text-ink-3 whitespace-nowrap">
                    {TEXTO_ESTADO_MESA[estado]}
                  </span>
                  <span className="text-[10px] font-semibold text-ink-3">{counts[estado]}</span>
                </div>
              ))}
            </div>
            <p className="text-ink-3 text-[10px] font-mono mt-2.5 text-center tracking-wide">
              Tap · 2× tap · Mantener pulsado
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chip toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[11px] font-medium transition-all shadow-card
          ${open
            ? 'bg-surface-3 border-line-strong text-ink'
            : 'bg-canvas/80 border-line text-ink-3 hover:border-line-strong hover:text-ink-3 backdrop-blur-sm'
          }`}
      >
        <div className="flex items-center gap-0.5">
          {ESTADOS_LEYENDA.map((e) => (
            <Dot key={e} estado={e} />
          ))}
        </div>
        <span>Estados</span>
        <ChevronUp
          size={11}
          className={`transition-transform duration-200 ${open ? '' : 'rotate-180'}`}
        />
      </button>
    </div>
  );
}
