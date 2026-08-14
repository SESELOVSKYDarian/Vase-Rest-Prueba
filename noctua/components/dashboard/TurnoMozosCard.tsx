'use client';

import { Users } from 'lucide-react';
import { useMozosStore } from '@/store/mozosStore';

export function TurnoMozosCard() {
  const dailyOverrides = useMozosStore((state) => state.dailyOverrides);
  const getTurnoActual = useMozosStore((state) => state.getTurnoActual);
  const getAsignacionesTurnoActual = useMozosStore((state) => state.getAsignacionesTurnoActual);
  const asignaciones = getAsignacionesTurnoActual();
  const today = new Date().toISOString().split('T')[0];

  return <section className="rounded-2xl border border-[#1d2b21] bg-[#0e0e0e] p-6">
    <div className="mb-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3"><Users size={20} className="text-[#7ed957]" /><div><h2 className="text-white font-bold tracking-[0.18em] uppercase">Mozos del turno actual</h2><p className="text-[#7b9180] text-xs mt-1">{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div></div>
      {getTurnoActual() && <div className="rounded-full bg-[#7ed957]/15 px-4 py-2 text-sm font-semibold text-[#b7f397]">{getTurnoActual()}</div>}
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {asignaciones.map((asignacion) => { const isOverride = dailyOverrides.some((o) => o.fecha === today && o.turnos[asignacion.turno]?.[asignacion.zona] === asignacion.mozo.id); return <div key={asignacion.zona} className={`rounded-xl border bg-[#151a16] p-4 ${isOverride ? 'border-amber-500/50' : 'border-[#26362a]'}`}><div className="flex items-center justify-between"><p className="text-[#829487] text-xs uppercase font-semibold">{asignacion.zona}</p>{isOverride && <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] uppercase text-amber-300">Reemplazo</span>}</div><p className="mt-2 text-white font-semibold">{asignacion.mozo.nombre} {asignacion.mozo.apellido}</p></div>; })}
    </div>
  </section>;
}
