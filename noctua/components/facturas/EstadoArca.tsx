'use client';

import { memo } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/hooks/lib/utils';

export type ArcaEstado = {
  ok: boolean;
  mensaje: string;
  modo?: string;
  cuit?: string;
  puntoVenta?: number;
} | null;

interface EstadoArcaProps {
  arca: ArcaEstado;
}

function EstadoArcaBase({ arca }: EstadoArcaProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border p-4 flex items-start gap-3',
        arca?.ok
          ? 'border-green-500/30 bg-green-500/10'
          : arca
            ? 'border-red-500/30 bg-red-500/10'
            : 'border-line bg-canvas'
      )}
    >
      {arca?.ok ? (
        <CheckCircle className="text-green-700 dark:text-green-400 mt-0.5" size={20} />
      ) : (
        <AlertTriangle className={arca ? 'text-red-700 dark:text-red-400 mt-0.5' : 'text-yellow-700 dark:text-yellow-400 mt-0.5'} size={20} />
      )}
      <div>
        <h2 className="text-base text-ink font-medium">Estado ARCA</h2>
        <p className="text-sm text-ink-2 mt-1">
          {arca ? arca.mensaje : 'Todavía no se verificó ARCA.'}
        </p>
        {arca?.ok && (
          <p className="text-xs text-ink-3 mt-2">
            Modo: {arca.modo} | CUIT: {arca.cuit} | Punto de venta: {arca.puntoVenta}
          </p>
        )}
      </div>
    </section>
  );
}

export const EstadoArca = memo(EstadoArcaBase);
