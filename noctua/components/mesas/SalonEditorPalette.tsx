'use client';

import { useState } from 'react';
import { Armchair, Circle, ChevronLeft, ChevronRight, LayoutGrid, LayoutPanelTop, MapPin, Move, RectangleHorizontal, Square, Trash2, Plus, X, Sofa } from 'lucide-react';

export type SalonItemType = 'mesa-redonda' | 'mesa-rectangular' | 'silla' | 'sillon' | 'pared' | 'zona';

interface SalonEditorPaletteProps {
  onRemoveSelected: () => void;
  hasSelection: boolean;
  onCreateMesa: (numero?: number) => void;
  onAddItem: (type: Exclude<SalonItemType, 'mesa-redonda' | 'mesa-rectangular'>) => void;
  onAddMesa: (type: 'mesa-redonda' | 'mesa-rectangular') => void;
}

const ITEMS: { type: SalonItemType; label: string; icon: typeof Circle }[] = [
  { type: 'mesa-redonda', label: 'Mesa redonda', icon: Circle },
  { type: 'mesa-rectangular', label: 'Mesa rectangular', icon: RectangleHorizontal },
  { type: 'silla', label: 'Silla', icon: Armchair },
  { type: 'sillon', label: 'Sillón', icon: Sofa },
  { type: 'pared', label: 'Pared', icon: Square },
];

export function SalonEditorPalette({ onRemoveSelected, hasSelection, onCreateMesa, onAddItem, onAddMesa }: SalonEditorPaletteProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [zones, setZones] = useState(['Salón principal', 'Terraza exterior', 'Bar']);
  const [newZone, setNewZone] = useState('');
  const [newTableNumber, setNewTableNumber] = useState('');
  const addZone = () => { const value = newZone.trim(); if (!value || zones.includes(value)) return; setZones((current) => [...current, value]); setNewZone(''); };
  return (
    <aside className={`fixed right-0 top-24 bottom-0 z-[70] overflow-y-auto ${collapsed ? 'w-16' : 'w-72'} border-l border-[#2b3a2f] bg-[#111612]/95 ${collapsed ? 'p-3' : 'p-5'} shadow-2xl shadow-black/40 backdrop-blur-xl transition-all duration-300`} onPointerDown={(event) => event.stopPropagation()}>
      <button onClick={() => setCollapsed((value) => !value)} className="absolute -left-4 top-6 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#2b3a2f] bg-[#151a16] text-[#829487] shadow-lg transition hover:text-[#b7f397]" aria-label={collapsed ? 'Expandir biblioteca' : 'Contraer biblioteca'}>{collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button>
      {collapsed ? <div className="flex h-full flex-col items-center gap-5 pt-3"><LibraryIcon /><span className="mt-auto text-[10px] text-[#708375] [writing-mode:vertical-rl]">BIBLIOTECA</span></div> : <>
      <div className="mb-5 flex items-center gap-2">
        <LayoutGrid size={17} className="text-[#7ed957]" />
        <div><p className="text-white text-sm font-semibold">Biblioteca</p><p className="text-[#708375] text-xs mt-0.5">Arrastrá al salón</p></div>
      </div>
      <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[#708375]">Mesas y mobiliario</p>
      <div className="mb-3 flex gap-2"><input value={newTableNumber} onChange={(event) => setNewTableNumber(event.target.value)} type="number" placeholder="N° mesa" className="min-w-0 flex-1 rounded-xl border border-[#2b3a2f] bg-[#182019] px-3 py-2 text-xs text-white outline-none focus:border-[#7ed957]" /><button onClick={() => { const number = Number(newTableNumber); if (!number) return; onCreateMesa(number); setNewTableNumber(''); }} className="flex items-center gap-1 rounded-xl bg-[#7ed957] px-3 py-2 text-xs font-semibold text-[#0e0e0e]"><Plus size={15} /> Crear</button></div>
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map(({ type, label, icon: Icon }) => (
          <button key={type} draggable onClick={() => type.startsWith('mesa-') ? onAddMesa(type as 'mesa-redonda' | 'mesa-rectangular') : onAddItem(type as Exclude<SalonItemType, 'mesa-redonda' | 'mesa-rectangular'>)} onDragStart={(event) => event.dataTransfer.setData('application/vase-rest-item', type)} className="group flex min-h-[92px] cursor-grab flex-col items-center justify-center gap-3 rounded-2xl border border-[#26362a] bg-[#182019] text-[#829487] transition hover:border-[#7ed957]/40 hover:bg-[#7ed957]/10 hover:text-[#b7f397] active:cursor-grabbing">
            <Icon size={25} strokeWidth={1.6} /><span className="text-[11px] text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>
      <div className="hidden mt-6 border-t border-[#26362a] pt-5">
        <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><MapPin size={15} className="text-[#7ed957]" /><p className="text-[10px] uppercase tracking-[0.22em] text-[#708375]">Ubicaciones</p></div><span className="text-[10px] text-[#708375]">{zones.length}</span></div>
        <div className="mb-3 flex flex-wrap gap-2">{zones.map((zone) => <span key={zone} className="inline-flex items-center gap-1 rounded-full border border-[#2b3a2f] bg-[#182019] px-2.5 py-1 text-[11px] text-[#b7f397]">{zone}<button onClick={() => setZones((current) => current.filter((item) => item !== zone))} aria-label={`Eliminar ${zone}`}><X size={11} /></button></span>)}</div>
        <div className="flex gap-2"><input value={newZone} onChange={(event) => setNewZone(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addZone(); }} placeholder="Nuevo salón o zona" className="min-w-0 flex-1 rounded-xl border border-[#2b3a2f] bg-[#182019] px-3 py-2 text-xs text-white outline-none focus:border-[#7ed957]" /><button onClick={addZone} aria-label="Agregar ubicación" className="rounded-xl bg-[#7ed957] px-3 text-[#0e0e0e]"><Plus size={15} /></button></div>
      </div>
      <div className="hidden mt-6 border-t border-[#26362a] pt-5">
        <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[#708375]">Selección</p>
        <button onClick={onRemoveSelected} disabled={!hasSelection} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 px-3 py-3 text-sm text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={16} /> Eliminar elemento</button>
      </div>
      <div className="mt-6 flex items-start gap-2 rounded-xl bg-[#7ed957]/8 p-3 text-[#829487]"><Move size={15} className="mt-0.5 flex-shrink-0 text-[#7ed957]" /><p className="text-xs leading-relaxed">Arrastrá mesas, sillas o paredes al plano. Seleccioná un elemento para moverlo o eliminarlo.</p></div>
      </>}
    </aside>
  );
}

function LibraryIcon() {
  return <LayoutGrid size={21} className="text-[#7ed957]" />;
}
