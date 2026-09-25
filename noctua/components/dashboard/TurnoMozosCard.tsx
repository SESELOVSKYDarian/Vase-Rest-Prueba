'use client';

import { Users } from 'lucide-react';
import { useMozosStore } from '@/store/mozosStore';

export function TurnoMozosCard() {
  const dailyOverrides = useMozosStore((state) => state.dailyOverrides);
  const getTurnoActual = useMozosStore((state) => state.getTurnoActual);
  const getAsignacionesTurnoActual = useMozosStore((state) => state.getAsignacionesTurnoActual);
  const asignaciones = getAsignacionesTurnoActual();
  const today = new Date().toISOString().split('T')[0];

  return <section className="rounded-2xl border border-line bg-surface p-6">
    <div className="mb-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-strong"><Users size={18} /></span><div><h2 className="text-ink font-medium">Mozos del turno</h2><p className="text-ink-3 text-xs mt-1">{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div></div>
      {getTurnoActual() && <div className="rounded-full bg-brand/15 px-4 py-2 text-sm font-medium text-brand-strong capitalize">{getTurnoActual()}</div>}
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {asignaciones.map((asignacion) => { const isOverride = dailyOverrides.some((o) => o.fecha === today && o.turnos[asignacion.turno]?.[asignacion.zona] === asignacion.mozo.id); return <div key={asignacion.zona} className={`rounded-xl border bg-surface-2/60 p-4 ${isOverride ? 'border-amber-500/50' : 'border-line'}`}><div className="flex items-center justify-between"><p className="text-ink-3 text-xs font-medium">{asignacion.zona}</p>{isOverride && <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">Reemplazo</span>}</div><p className="mt-2 text-ink font-semibold">{asignacion.mozo.nombre} {asignacion.mozo.apellido}</p></div>; })}
    </div>
  </section>;
}
