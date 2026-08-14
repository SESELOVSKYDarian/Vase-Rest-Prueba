// Canvas arquitectónico del restaurante: mesas posicionadas absolutamente sobre un plano SVG.
'use client';

import { useRef, useEffect, useState, useCallback, memo, useMemo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Move, Hand, Edit3, Eye, Undo2, Redo2, Save, X, Library } from 'lucide-react';
import { MesaCard } from './MesaCard';
import { getFormaVisual } from './mesaEstadoColors';
import { useMesasStore } from '@/store/mesasStore';
import type { Mesa, MesaGestureCallbacks } from '@/types/mesa';
import { SalonEditorPalette, type SalonItemType } from './SalonEditorPalette';

interface SalonItem { id: string; type: SalonItemType; x: number; y: number; tableId?: string; zoneName?: string; width?: number; height?: number; rotation?: number; }

/** Una mesa es elegible para unión si no forma parte ya de un grupo unido. */
function esElegibleParaUnir(mesa: Mesa): boolean {
  return !mesa.mesasUnidas || mesa.mesasUnidas.length === 0;
}

// ── Dimensiones del canvas ────────────────────────────────────────────────────
const CANVAS_W = 1600;
const CANVAS_H = 870;
const GRID_SIZE = 2;
const TABLE_GAP = 24;

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── Definición de zonas sobre el canvas ──────────────────────────────────────
interface ZoneArea {
  id:       string;
  label:    string;
  x:        number;
  y:        number;
  w:        number;
  h:        number;
  outdoor?: boolean;
  service?: boolean;
}

const ZONE_AREAS: ZoneArea[] = [
  { id: 'TERRAZA EXTERIOR', label: 'TERRAZA EXTERIOR', x: 0,    y: 0,   w: 1600, h: 220, outdoor: true },
  { id: 'SALÓN PRINCIPAL',  label: 'SALÓN PRINCIPAL',  x: 0,    y: 220, w: 1120, h: 480 },
  { id: 'BAR',              label: 'BAR',              x: 1120, y: 220, w: 480,  h: 310 },
  { id: 'ZONA COCINA',      label: 'ZONA COCINA',      x: 1120, y: 530, w: 480,  h: 170, service: true },
  { id: 'ZONA SOFÁS',       label: 'ZONA SOFÁS',       x: 0,    y: 700, w: 620,  h: 170 },
];

const FALLBACK_ZONE = ZONE_AREAS[1]; // SALÓN PRINCIPAL como fallback

// ── Cálculo de posición por defecto en grilla dentro de la zona ───────────────
const SPACING_X = 205;
const SPACING_Y = 215;
const PAD_X     = 70;
const PAD_Y     = 40;

/** Quita acentos y normaliza a minúsculas para comparaciones robustas */
function stripped(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Normaliza el nombre de zona: ignora mayúsculas/minúsculas y acentos.
 * Si no hay coincidencia, retorna FALLBACK_ZONE.id para que todas las mesas
 * desconocidas queden en un mismo grupo con posiciones secuenciales.
 */
function normalizeZoneId(zona: string | undefined): string {
  if (!zona) return FALLBACK_ZONE.id;
  const match = ZONE_AREAS.find((z) => stripped(z.id) === stripped(zona));
  return match?.id ?? FALLBACK_ZONE.id;
}

function computeDefaultPositions(mesas: Mesa[]): Map<string, { x: number; y: number }> {
  // Agrupar por zona normalizada — evita que cada mesa desconocida tenga su
  // propio grupo y caiga en la misma posición fallback (idx=0 de todas).
  const byZone = new Map<string, Mesa[]>();
  for (const m of mesas) {
    const zoneId = normalizeZoneId(m.zona);
    const list   = byZone.get(zoneId) ?? [];
    list.push(m);
    byZone.set(zoneId, list);
  }

  const positions = new Map<string, { x: number; y: number }>();

  for (const [zoneId, zoneMesas] of byZone) {
    const zone = ZONE_AREAS.find((z) => z.id === zoneId) ?? FALLBACK_ZONE;
    const cols = Math.max(1, Math.floor((zone.w - PAD_X * 2) / SPACING_X));

    zoneMesas.forEach((mesa, idx) => {
      // Usar posición guardada solo si es significativamente distinta del origen
      // (threshold > 50 para ignorar valores residuales del DB como pos_x=1)
      if (mesa.posicion.x > 50 || mesa.posicion.y > 50) {
        positions.set(mesa.id, mesa.posicion);
        return;
      }
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      positions.set(mesa.id, {
        x: zone.x + PAD_X + col * SPACING_X,
        y: zone.y + PAD_Y + row * SPACING_Y,
      });
    });
  }

  return positions;
}

// ── Tamaño del contenedor para calcular centros de conexión ──────────────────
function localGetContenedorSize(capacidad: number): { w: number; h: number } {
  return getFormaVisual(capacidad) === 'rectangular' ? { w: 200, h: 160 } : { w: 160, h: 160 };
}

// ── Gestos vacíos para modo edición ──────────────────────────────────────────
const NOOP_GESTURES: MesaGestureCallbacks = {
  onTap: () => {},
  onDoubleTap: () => {},
  onLongPress: () => {},
  onSwipe: () => {},
};

// ── Props del componente ──────────────────────────────────────────────────────
interface MesasCanvasLayoutProps {
  mesas:                 Mesa[];
  mesasSeleccionadas:    string[];
  mergeSelectedIds:      string[];
  isSelectionMode:       boolean;
  mozoRequeridoIds:      Set<string>;
  gestures:              MesaGestureCallbacks;
  onDelete:              (id: string) => void;
  onToggleSelectionMode: () => void;
  onCreateMesa: (numero?: number, capacidad?: number) => void;
}

export const MesasCanvasLayout = memo(function MesasCanvasLayout({
  mesas,
  mesasSeleccionadas,
  mergeSelectedIds,
  isSelectionMode,
  mozoRequeridoIds,
  gestures,
  onDelete,
  onToggleSelectionMode,
  onCreateMesa: onCreateMesaBase,
}: MesasCanvasLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale]       = useState(1);
  const [zoom, setZoom]         = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [salonItems, setSalonItems] = useState<SalonItem[]>([]);
  const [pastItems, setPastItems] = useState<SalonItem[][]>([]);
  const [futureItems, setFutureItems] = useState<SalonItem[][]>([]);
  const [selectedSalonItem, setSelectedSalonItem] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; mesa: Mesa } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [handMode, setHandMode] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panPointer = useRef<{ x: number; y: number } | null>(null);
  const normalizedChairLayoutRef = useRef<Set<string>>(new Set());
  const [chairToAssign, setChairToAssign] = useState<string | null>(null);
  const [tableDraft, setTableDraft] = useState<'mesa-redonda' | 'mesa-rectangular' | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [tableCapacity, setTableCapacity] = useState('4');
  const [zoneDraft, setZoneDraft] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [tableShapes, setTableShapes] = useState<Record<number, 'circular' | 'cuadrada' | 'rectangular'>>({});
  const [tableSections, setTableSections] = useState<Record<number, string>>({});
  const moverMesa = useMesasStore((s) => s.moverMesa);
  const editarMesa = useMesasStore((s) => s.editarMesa);
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null);
  const [editingNumber, setEditingNumber] = useState('');
  const [editingCapacity, setEditingCapacity] = useState('');
  const onCreateMesa = useCallback((numero?: number, capacidad?: number) => {
    if (numero && activeSection) setTableSections((current) => ({ ...current, [numero]: activeSection }));
    onCreateMesaBase(numero, capacidad);
  }, [activeSection, onCreateMesaBase]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('vase-rest-salon-items');
      if (saved) setSalonItems(JSON.parse(saved) as SalonItem[]);
    } catch { /* iniciar vacío si el almacenamiento local no es válido */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem('vase-rest-salon-items', JSON.stringify(salonItems)); } catch { /* storage no disponible */ }
  }, [salonItems]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('vase-rest-table-sections');
      if (saved) setTableSections(JSON.parse(saved) as Record<number, string>);
      const savedShapes = window.localStorage.getItem('vase-rest-table-shapes');
      if (savedShapes) setTableShapes(JSON.parse(savedShapes) as Record<number, 'circular' | 'cuadrada' | 'rectangular'>);
      const savedActiveSection = window.localStorage.getItem('vase-rest-active-section');
      if (savedActiveSection) setActiveSection(savedActiveSection);
    } catch { /* storage no disponible */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem('vase-rest-table-sections', JSON.stringify(tableSections)); } catch { /* storage no disponible */ }
  }, [tableSections]);

  useEffect(() => {
    try { window.localStorage.setItem('vase-rest-table-shapes', JSON.stringify(tableShapes)); } catch { /* storage no disponible */ }
  }, [tableShapes]);

  useEffect(() => {
    try { if (activeSection) window.localStorage.setItem('vase-rest-active-section', activeSection); } catch { /* storage no disponible */ }
  }, [activeSection]);

  const commitSalonItems = useCallback((next: SalonItem[]) => {
    setPastItems((history) => [...history, salonItems]);
    setFutureItems([]);
    setSalonItems(next);
  }, [salonItems]);

  const undoSalonChange = useCallback(() => {
    setPastItems((history) => {
      const previous = history[history.length - 1];
      if (!previous) return history;
      setFutureItems((future) => [salonItems, ...future]);
      setSalonItems(previous);
      return history.slice(0, -1);
    });
  }, [salonItems]);

  const redoSalonChange = useCallback(() => {
    setFutureItems((future) => {
      const next = future[0];
      if (!next) return future;
      setPastItems((history) => [...history, salonItems]);
      setSalonItems(next);
      return future.slice(1);
    });
  }, [salonItems]);

  // Escala responsive: ajusta el canvas al ancho del contenedor
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setScale(Math.min(1, w / CANVAS_W));
      }
    };
    update();
    const obs = new ResizeObserver(update);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Posiciones calculadas (se recalculan solo si cambian las mesas)
  const positions = useMemo(() => computeDefaultPositions(mesas), [mesas]);
  const sections = useMemo(() => salonItems.filter((item) => item.type === 'zona' && item.zoneName).map((item) => item.zoneName as string), [salonItems]);
  const visibleMesas = useMemo(() => mesas.filter((mesa) => !activeSection || tableSections[mesa.numero] === activeSection || (!tableSections[mesa.numero] && activeSection === sections[0])), [mesas, activeSection, tableSections, sections]);
  const selectedItem = useMemo(() => salonItems.find((item) => item.id === selectedSalonItem) ?? null, [salonItems, selectedSalonItem]);
  const findNearestMesa = useCallback((x: number, y: number) => {
    return visibleMesas.reduce<{ mesa: Mesa; distance: number } | null>((best, mesa) => {
      const pos = positions.get(mesa.id) ?? mesa.posicion;
      const size = localGetContenedorSize(mesa.capacidad);
      const distance = Math.hypot((x + 12) - (pos.x + size.w / 2), (y + 12) - (pos.y + size.h / 2));
      return distance < 130 && (!best || distance < best.distance) ? { mesa, distance } : best;
    }, null)?.mesa;
  }, [visibleMesas, positions]);

  const snapChairToMesa = useCallback((x: number, y: number, mesa: Mesa) => {
    const pos = positions.get(mesa.id) ?? mesa.posicion;
    const size = localGetContenedorSize(mesa.capacidad);
    const centerX = pos.x + size.w / 2;
    const centerY = pos.y + size.h / 2;
    const angle = Math.atan2((y + 12) - centerY, (x + 12) - centerX);
    const forma = tableShapes[mesa.numero] ?? getFormaVisual(mesa.capacidad);
    const radiusX = forma === 'rectangular' ? 78 : 57;
    const radiusY = forma === 'rectangular' ? 52 : 57;
    return { x: snapToGrid(centerX + Math.cos(angle) * radiusX - 12), y: snapToGrid(centerY + Math.sin(angle) * radiusY - 12), rotation: (angle * 180) / Math.PI + 90 };
  }, [positions, tableShapes]);

  useEffect(() => {
    if (!activeSection && sections.length > 0) setActiveSection(sections[0]);
  }, [activeSection, sections]);

  useEffect(() => {
    const additions: SalonItem[] = [];
    for (const mesa of visibleMesas) {
      const existingCount = salonItems.filter((item) => item.type === 'silla' && item.tableId === mesa.id).length;
      if (existingCount >= mesa.capacidad) continue;
      const pos = positions.get(mesa.id) ?? mesa.posicion;
      const size = localGetContenedorSize(mesa.capacidad);
      const forma = tableShapes[mesa.numero] ?? getFormaVisual(mesa.capacidad);
      const radiusX = forma === 'rectangular' ? 78 : 57;
      const radiusY = forma === 'rectangular' ? 52 : 57;
      for (let index = existingCount; index < mesa.capacidad; index += 1) {
        const angle = (Math.PI * 2 * index) / mesa.capacidad - Math.PI / 2;
        additions.push({ id: `silla-${mesa.id}-${index}`, type: 'silla', x: snapToGrid(pos.x + size.w / 2 + Math.cos(angle) * radiusX - 12), y: snapToGrid(pos.y + size.h / 2 + Math.sin(angle) * radiusY - 12), width: 24, height: 24, rotation: (angle * 180) / Math.PI + 90, tableId: mesa.id, zoneName: tableSections[mesa.numero] ?? activeSection ?? undefined });
      }
    }
    if (additions.length > 0) setSalonItems((items) => {
      const existingIds = new Set(items.map((item) => item.id));
      return [...items, ...additions.filter((item) => !existingIds.has(item.id))];
    });
  }, [visibleMesas, salonItems, positions, tableSections, activeSection, tableShapes]);

  useEffect(() => {
    const overfull = visibleMesas.filter((mesa) => salonItems.filter((item) => item.type === 'silla' && item.tableId === mesa.id).length > mesa.capacidad);
    if (overfull.length === 0) return;
    setSalonItems((items) => items.filter((item) => {
      if (item.type !== 'silla' || !item.tableId) return true;
      const mesa = overfull.find((candidate) => candidate.id === item.tableId);
      if (!mesa) return true;
      const siblings = items.filter((candidate) => candidate.type === 'silla' && candidate.tableId === mesa.id);
      return siblings.findIndex((candidate) => candidate.id === item.id) < mesa.capacidad;
    }));
  }, [visibleMesas, salonItems]);

  useEffect(() => {
    const mesasToNormalize = visibleMesas.filter((mesa) => !normalizedChairLayoutRef.current.has(mesa.id) && salonItems.some((item) => item.type === 'silla' && item.tableId === mesa.id && ((item.width ?? 36) > 24 || (item.height ?? 36) > 24)));
    if (mesasToNormalize.length === 0) return;
    mesasToNormalize.forEach((mesa) => normalizedChairLayoutRef.current.add(mesa.id));
    setSalonItems((items) => items.map((item) => {
      if (item.type !== 'silla' || !item.tableId) return item;
      const mesa = mesasToNormalize.find((candidate) => candidate.id === item.tableId);
      if (!mesa) return item;
      const siblings = items.filter((candidate) => candidate.type === 'silla' && candidate.tableId === mesa.id);
      const index = siblings.findIndex((candidate) => candidate.id === item.id);
      const pos = positions.get(mesa.id) ?? mesa.posicion;
      const size = localGetContenedorSize(mesa.capacidad);
      const forma = tableShapes[mesa.numero] ?? getFormaVisual(mesa.capacidad);
      const radiusX = forma === 'rectangular' ? 78 : 57;
      const radiusY = forma === 'rectangular' ? 52 : 57;
      const angle = (Math.PI * 2 * index) / Math.max(1, siblings.length) - Math.PI / 2;
      return { ...item, x: snapToGrid(pos.x + size.w / 2 + Math.cos(angle) * radiusX - 12), y: snapToGrid(pos.y + size.h / 2 + Math.sin(angle) * radiusY - 12), width: 24, height: 24, rotation: (angle * 180) / Math.PI + 90 };
    }));
  }, [visibleMesas, salonItems, positions, tableShapes]);
  const canvasScale = scale * zoom;

  const handleCanvasWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.altKey || event.ctrlKey) setZoom((value) => Math.max(0.55, Math.min(1.8, value - event.deltaY * 0.0015)));
    else setPan((value) => ({ x: value.x - event.deltaX, y: value.y - event.deltaY }));
  }, []);

  const handleCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!handMode) return;
    panPointer.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [handMode]);

  const handleCanvasPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!handMode || !panPointer.current) return;
    const dx = event.clientX - panPointer.current.x;
    const dy = event.clientY - panPointer.current.y;
    panPointer.current = { x: event.clientX, y: event.clientY };
    setPan((value) => ({ x: value.x + dx, y: value.y + dy }));
  }, [handMode]);

  // Números de mesas unidas por cada mesa (para mostrar badge combinado)
  const getMesasUnidasNums = useCallback((mesa: Mesa): number[] => {
    if (!mesa.mesasUnidas || mesa.mesasUnidas.length === 0) return [];
    return mesa.mesasUnidas
      .map((id) => mesas.find((m) => m.id === id)?.numero ?? 0)
      .filter((n) => n > 0);
  }, [mesas]);

  // Líneas SVG conectoras entre mesas unidas (sin duplicados)
  const connectorLines = useMemo((): ReactNode[] => {
    const drawn = new Set<string>();
    const lines: ReactNode[] = [];

    for (const mesa of mesas) {
      if (!mesa.mesasUnidas || mesa.mesasUnidas.length === 0) continue;
      const pos1 = positions.get(mesa.id);
      if (!pos1) continue;
      const { w: w1, h: h1 } = localGetContenedorSize(mesa.capacidad);
      const cx1 = pos1.x + w1 / 2;
      const cy1 = pos1.y + h1 / 2;

      for (const otherId of mesa.mesasUnidas) {
        const pairKey = [mesa.id, otherId].sort().join('|');
        if (drawn.has(pairKey)) continue;
        drawn.add(pairKey);

        const other = mesas.find((m) => m.id === otherId);
        if (!other) continue;
        const pos2 = positions.get(otherId);
        if (!pos2) continue;
        const { w: w2, h: h2 } = localGetContenedorSize(other.capacidad);
        const cx2 = pos2.x + w2 / 2;
        const cy2 = pos2.y + h2 / 2;
        const mx = (cx1 + cx2) / 2;
        const my = (cy1 + cy2) / 2;

        lines.push(
          <g key={pairKey}>
            {/* Halo suave */}
            <line x1={cx1} y1={cy1} x2={cx2} y2={cy2}
              stroke="#d97706" strokeWidth="10" strokeOpacity="0.1" strokeLinecap="round" />
            {/* Línea punteada principal */}
            <line x1={cx1} y1={cy1} x2={cx2} y2={cy2}
              stroke="#d97706" strokeWidth="2" strokeDasharray="14 7"
              strokeOpacity="0.75" strokeLinecap="round" />
            {/* Ícono de enlace en el medio */}
            <circle cx={mx} cy={my} r={9} fill="#0f0f0f" stroke="#d97706" strokeWidth="1.5" opacity="0.9" />
            <line x1={mx - 4} y1={my} x2={mx + 4} y2={my} stroke="#d97706" strokeWidth="2" opacity="0.9" />
            <circle cx={mx - 4} cy={my} r={2} fill="#d97706" opacity="0.9" />
            <circle cx={mx + 4} cy={my} r={2} fill="#d97706" opacity="0.9" />
          </g>
        );
      }
    }
    return lines;
  }, [mesas, positions]);

  const handleDragEnd = useCallback(
    (mesaId: string, origPos: { x: number; y: number }, offsetX: number, offsetY: number) => {
      const mesa = mesas.find((item) => item.id === mesaId);
      if (!mesa) return;
      const size = localGetContenedorSize(mesa.capacidad);
      let newX = Math.max(-90, Math.min(CANVAS_W - 60, snapToGrid(origPos.x + offsetX)));
      let newY = Math.max(-70, Math.min(CANVAS_H - 60, snapToGrid(origPos.y + offsetY)));
      const collides = (x: number, y: number) => visibleMesas.some((other) => {
        if (other.id === mesaId) return false;
        const otherPos = positions.get(other.id) ?? other.posicion;
        const otherSize = localGetContenedorSize(other.capacidad);
        return overlaps({ x: x - TABLE_GAP, y: y - TABLE_GAP, w: size.w + TABLE_GAP * 2, h: size.h + TABLE_GAP * 2 }, { ...otherPos, w: otherSize.w, h: otherSize.h });
      }) || salonItems.some((item) => item.type === 'silla' && item.tableId !== mesaId && overlaps({ x: x - 8, y: y - 8, w: size.w + 16, h: size.h + 16 }, { x: item.x, y: item.y, w: item.width ?? 24, h: item.height ?? 24 }));
      let attempts = 0;
      while (collides(newX, newY) && attempts < 800) {
        newX = snapToGrid(newX + GRID_SIZE);
        if (newX > CANVAS_W - 60) { newX = -90; newY = snapToGrid(newY + GRID_SIZE); }
        attempts += 1;
      }
      if (collides(newX, newY)) { newX = origPos.x; newY = origPos.y; }
      const deltaX = newX - origPos.x;
      const deltaY = newY - origPos.y;
      if (deltaX || deltaY) setSalonItems((items) => items.map((item) => item.tableId === mesaId ? { ...item, x: item.x + deltaX, y: item.y + deltaY } : item));
      moverMesa(mesaId, { x: newX, y: newY });
    },
    [moverMesa, mesas, visibleMesas, positions, salonItems]
  );

  const handleCanvasDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/vase-rest-item') as SalonItemType;
    if (!type || !containerRef.current) return;
    if (type === 'mesa-redonda' || type === 'mesa-rectangular') { setTableDraft(type); return; }
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(30, Math.min(CANVAS_W - 260, (event.clientX - rect.left - pan.x) / canvasScale - 70));
    const y = Math.max(30, Math.min(CANVAS_H - 180, (event.clientY - rect.top - pan.y) / canvasScale - 50));
    const id = `${type}-${Date.now()}`;
    let snappedX = snapToGrid(x);
    let snappedY = snapToGrid(y);
    let rotation = 0;
    let tableId: string | undefined;
    const containingZone = salonItems.find((item) => item.type === 'zona' && snappedX >= item.x && snappedY >= item.y && snappedX <= item.x + (item.width ?? 320) && snappedY <= item.y + (item.height ?? 200));
    if (type === 'silla') {
      const nearest = findNearestMesa(snappedX, snappedY);
      if (nearest) { const snapped = snapChairToMesa(snappedX, snappedY, nearest); snappedX = snapped.x; snappedY = snapped.y; rotation = snapped.rotation; tableId = nearest.id; void editarMesa(nearest.id, { numero: nearest.numero, capacidad: nearest.capacidad + 1 }); }
    }
    commitSalonItems([...salonItems, { id, type, x: snappedX, y: snappedY, rotation, tableId, zoneName: containingZone?.zoneName ?? activeSection ?? undefined }]);
    setSelectedSalonItem(id);
  }, [commitSalonItems, salonItems, findNearestMesa, snapChairToMesa, editarMesa, activeSection, pan, canvasScale]);

  const addSalonItemAtCenter = useCallback((type: SalonItemType) => {
    if (type === 'mesa-redonda' || type === 'mesa-rectangular') { setTableDraft(type); return; }
    if (type === 'zona') { setZoneDraft(true); return; }
    const id = `${type}-${Date.now()}`;
    commitSalonItems([...salonItems, { id, type, x: snapToGrid(CANVAS_W / 2 - 80), y: snapToGrid(CANVAS_H / 2 - 60), zoneName: activeSection ?? undefined }]);
    setSelectedSalonItem(id);
  }, [commitSalonItems, salonItems, activeSection]);

  const createZone = useCallback(() => {
    const name = zoneName.trim();
    if (!name) return;
    const id = `zona-${Date.now()}`;
    commitSalonItems([...salonItems, { id, type: 'zona', x: snapToGrid(CANVAS_W / 2 - 160), y: snapToGrid(CANVAS_H / 2 - 100), zoneName: name, width: 320, height: 200 }]);
    setZoneName('');
    setZoneDraft(false);
  }, [commitSalonItems, salonItems, zoneName]);

  const addMesaFromShape = useCallback((type: 'mesa-redonda' | 'mesa-rectangular') => setTableDraft(type), []);

  const handleSalonItemMove = useCallback((id: string, offsetX: number, offsetY: number) => {
    const current = salonItems.find((item) => item.id === id);
    if (!current) return;
    let x = Math.max(-90, Math.min(CANVAS_W - 30, snapToGrid(current.x + offsetX)));
    let y = Math.max(-70, Math.min(CANVAS_H - 30, snapToGrid(current.y + offsetY)));
    let rotation = current.rotation;
    let tableId = current.tableId;
    if (current.type === 'silla') {
      const nearest = findNearestMesa(x, y);
      if (nearest) {
        const snapped = snapChairToMesa(x, y, nearest);
        x = snapped.x;
        y = snapped.y;
        rotation = snapped.rotation;
        tableId = nearest.id;
        if (current.tableId !== nearest.id) {
          const previous = visibleMesas.find((mesa) => mesa.id === current.tableId);
          if (previous) void editarMesa(previous.id, { numero: previous.numero, capacidad: Math.max(1, previous.capacidad - 1) });
          void editarMesa(nearest.id, { numero: nearest.numero, capacidad: nearest.capacidad + 1 });
        }
      } else if (current.tableId) {
        const previous = visibleMesas.find((mesa) => mesa.id === current.tableId);
        if (previous) void editarMesa(previous.id, { numero: previous.numero, capacidad: Math.max(1, previous.capacidad - 1) });
        tableId = undefined;
      }
    }
    commitSalonItems(salonItems.map((item) => item.id === id ? { ...item, x, y, rotation, tableId } : item));
  }, [commitSalonItems, salonItems, findNearestMesa, snapChairToMesa, editarMesa, visibleMesas]);

  const removeSelectedSalonItem = useCallback(() => {
    if (!selectedSalonItem) return;
    const selected = salonItems.find((item) => item.id === selectedSalonItem);
    if (selected?.type === 'silla' && selected.tableId) {
      const mesa = visibleMesas.find((item) => item.id === selected.tableId);
      if (mesa) void editarMesa(mesa.id, { numero: mesa.numero, capacidad: Math.max(1, mesa.capacidad - 1) });
    }
    commitSalonItems(salonItems.filter((item) => item.id !== selectedSalonItem));
    setSelectedSalonItem(null);
  }, [commitSalonItems, selectedSalonItem, salonItems, visibleMesas, editarMesa]);

  const handleMesaContextMenu = useCallback((event: React.MouseEvent, mesa: Mesa) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, mesa });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedSalonItem && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        removeSelectedSalonItem();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [removeSelectedSalonItem, selectedSalonItem]);

  const beginResize = useCallback((event: React.PointerEvent<HTMLButtonElement>, item: SalonItem, direction: string) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = item.width ?? (item.type === 'pared' ? 176 : item.type === 'sillon' ? 72 : 24);
    const startHeight = item.height ?? (item.type === 'pared' ? 12 : item.type === 'sillon' ? 42 : 24);
    const startItemX = item.x;
    const startItemY = item.y;
    setPastItems((history) => [...history, salonItems]);
    setFutureItems([]);
    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / canvasScale;
      const dy = (moveEvent.clientY - startY) / canvasScale;
      setSalonItems((items) => items.map((current) => {
        if (current.id !== item.id) return current;
        const left = direction.includes('w');
        const top = direction.includes('n');
        const horizontal = direction.includes('e') || left;
        const vertical = direction.includes('s') || top;
        const width = horizontal ? Math.max(20, startWidth + (left ? -dx : dx)) : startWidth;
        const height = vertical ? Math.max(12, startHeight + (top ? -dy : dy)) : startHeight;
        return { ...current, x: left ? startItemX + (startWidth - width) : startItemX, y: top ? startItemY + (startHeight - height) : startItemY, width: snapToGrid(width), height: snapToGrid(height) };
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [canvasScale, salonItems]);

  const renderSalonItem = (item: SalonItem) => {
    const selected = selectedSalonItem === item.id;
    const common = { position: 'absolute' as const, left: item.x, top: item.y, zIndex: selected ? 25 : 8 };
    const visual = item.type === 'silla' ? <div style={{ width: item.width ?? 24, height: item.height ?? 24 }} className="relative"><div className="absolute inset-x-[18%] top-0 h-[34%] rounded-[3px] border border-[#9fb4a5] bg-[#26352a]" /><div className="absolute inset-x-[10%] bottom-[8%] h-[58%] rounded-[4px] border border-[#9fb4a5] bg-[#33483a] shadow-sm" /></div> : item.type === 'sillon' ? <div style={{ width: item.width ?? 72, height: item.height ?? 42 }} className="relative"><div className="absolute inset-x-[8%] top-[8%] h-[58%] rounded-[10px] border-2 border-[#91a99a] bg-[#26372d]" /><div className="absolute bottom-[6%] left-0 h-[58%] w-[18%] rounded-[7px] border border-[#91a99a] bg-[#3a5142]" /><div className="absolute bottom-[6%] right-0 h-[58%] w-[18%] rounded-[7px] border border-[#91a99a] bg-[#3a5142]" /><div className="absolute inset-x-[18%] bottom-[4%] h-[42%] rounded-[6px] border border-[#91a99a] bg-[#405947]" /></div> : item.type === 'pared' ? <div style={{ width: item.width ?? 176, height: item.height ?? 12 }} className="rounded-sm border border-[#87968c] bg-[#66726a] shadow-sm" /> : item.type === 'zona' ? null : item.type === 'mesa-rectangular' ? <div className="h-24 w-36 rounded-2xl border-2 border-[#7ed957] bg-[#7ed957]/10" /> : <div className="h-28 w-28 rounded-full border-2 border-[#7ed957] bg-[#7ed957]/10" />;
    return <motion.div key={item.id} drag={editMode && !previewMode} dragMomentum={false} dragElastic={0} onClick={() => setSelectedSalonItem(item.id)} onDoubleClick={() => item.type === 'pared' && commitSalonItems(salonItems.map((current) => current.id === item.id ? { ...current, rotation: ((current as SalonItem & { rotation?: number }).rotation ?? 0) + 90 } : current))} onDragEnd={(_, info) => {
      handleSalonItemMove(item.id, info.offset.x / canvasScale, info.offset.y / canvasScale);
    }} style={common} className={`${editMode && !previewMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} text-[#b7f397] ${selected ? 'opacity-100' : 'opacity-90'}`}><div className="relative" style={{ transform: `rotate(${(item as SalonItem & { rotation?: number }).rotation ?? 0}deg)` }}>{visual}{selected && item.type === 'zona' && <div className="absolute -right-24 -top-3 flex items-center gap-1 rounded-lg border border-[#2b3a2f] bg-[#151a16] p-1 shadow-lg"><button onClick={(event) => { event.stopPropagation(); commitSalonItems(salonItems.map((current) => current.id === item.id ? { ...current, width: Math.max(160, (current.width ?? 320) - 32), height: Math.max(120, (current.height ?? 200) - 24) } : current)); }} className="h-6 w-6 rounded text-[#b7f397] hover:bg-white/10">−</button><span className="px-1 text-[10px] text-[#829487]">Tamaño</span><button onClick={(event) => { event.stopPropagation(); commitSalonItems(salonItems.map((current) => current.id === item.id ? { ...current, width: (current.width ?? 320) + 32, height: (current.height ?? 200) + 24 } : current)); }} className="h-6 w-6 rounded text-[#b7f397] hover:bg-white/10">+</button></div>}{selected && item.type === 'pared' && <button onClick={(event) => { event.stopPropagation(); commitSalonItems(salonItems.map((current) => current.id === item.id ? { ...current, rotation: ((current as SalonItem & { rotation?: number }).rotation ?? 0) + 90 } : current)); }} className="absolute -right-9 -top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[#7ed957] bg-[#151a16] text-xs text-[#b7f397] shadow-lg" title="Rotar pared">↻</button>}</div></motion.div>;
  };

  // Restablece todas las posiciones a 0 → computeDefaultPositions las recalcula
  const handleResetPositions = useCallback(async () => {
    setResetting(true);
    try {
      await Promise.all(mesas.map((m) => moverMesa(m.id, { x: 0, y: 0 })));
    } finally {
      setResetting(false);
    }
  }, [mesas, moverMesa]);

  // Hay algo que restablecer si alguna mesa tiene posición personalizada guardada
  const canReset = useMemo(
    () => mesas.some((m) => m.posicion.x > 50 || m.posicion.y > 50),
    [mesas]
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      {/* Toolbar del plano — 3 acciones centradas */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.05}
        initial={false}
        animate={{ x: toolbarPosition.x, y: toolbarPosition.y }}
        onDragEnd={(_, info) => setToolbarPosition((position) => ({ x: position.x + info.offset.x, y: position.y + info.offset.y }))}
        className="fixed left-1/2 top-[108px] z-[120] -translate-x-1/2 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2 rounded-2xl border border-[#2b3a2f] bg-[#151a16]/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <button onClick={() => setHandMode((value) => !value)} className={`rounded-xl p-2.5 ${handMode ? 'bg-[#7ed957] text-[#0e0e0e]' : 'text-[#829487] hover:bg-white/5 hover:text-white'}`} title="Mover viewport"><Hand size={17} /></button>
          <div className="flex items-center rounded-xl bg-[#0e0e0e] p-1">
            <button onClick={() => { setEditMode(true); setPreviewMode(false); }} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${editMode && !previewMode ? 'bg-[#7ed957] text-[#0e0e0e]' : 'text-[#829487] hover:text-white'}`}><Edit3 size={14} /> Editar</button>
            <button onClick={() => { setEditMode(false); setPreviewMode(true); setPaletteOpen(false); }} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${previewMode || !editMode ? 'bg-[#7ed957] text-[#0e0e0e]' : 'text-[#829487] hover:text-white'}`}><Eye size={14} /> Previsualizar</button>
          </div>
          <div className="h-7 w-px bg-[#2b3a2f]" />
          <button onClick={undoSalonChange} disabled={pastItems.length === 0} title="Deshacer" className="rounded-xl p-2.5 text-[#829487] hover:bg-white/5 hover:text-white disabled:opacity-30"><Undo2 size={17} /></button>
          <button onClick={redoSalonChange} disabled={futureItems.length === 0} title="Rehacer" className="rounded-xl p-2.5 text-[#829487] hover:bg-white/5 hover:text-white disabled:opacity-30"><Redo2 size={17} /></button>
          <div className="h-7 w-px bg-[#2b3a2f]" />
          <button onClick={() => { setEditMode(true); setPreviewMode(false); setPaletteOpen((open) => !open); setSectionsOpen(false); }} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${paletteOpen && editMode ? 'bg-[#7ed957]/15 text-[#b7f397]' : 'text-[#829487] hover:bg-white/5 hover:text-white'}`}><Library size={16} /> Biblioteca</button>
          <button onClick={() => { setEditMode(true); setPreviewMode(false); setSectionsOpen((open) => !open); setPaletteOpen(false); }} className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition ${sectionsOpen ? 'bg-[#7ed957]/15 text-[#b7f397]' : 'text-[#829487] hover:bg-white/5 hover:text-white'}`}>Secciones</button>
          <button onClick={handleResetPositions} disabled={resetting || !canReset} title="Restablecer posiciones" className="rounded-xl px-3 py-2.5 text-xs font-semibold text-[#829487] transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">Restablecer</button>
          <button onClick={() => setEditMode(false)} className="rounded-xl p-2.5 text-[#829487] hover:bg-white/5 hover:text-white" title="Cancelar"><X size={17} /></button>
          <button onClick={() => setEditMode(false)} className="flex items-center gap-2 rounded-xl bg-[#7ed957] px-4 py-2.5 text-xs font-semibold text-[#0e0e0e] transition hover:bg-[#b7f397]" title="Guardar cambios"><Save size={16} /> Guardar</button>
        </div>
      </motion.div>

      {mesasSeleccionadas.length > 1 && <button onClick={onToggleSelectionMode} className="fixed bottom-8 left-1/2 z-[110] -translate-x-1/2 rounded-2xl border border-amber-500/40 bg-[#2a1c08] px-5 py-3 text-sm font-semibold text-amber-300 shadow-2xl shadow-black/40 transition hover:bg-amber-500/20">Unir mesas ({mesasSeleccionadas.length})</button>}

      {/* Canvas wrapper — escala responsive */}
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 w-full rounded-2xl overflow-hidden"
        onWheel={handleCanvasWheel}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={() => { panPointer.current = null; }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleCanvasDrop}
        onClick={(event) => { setContextMenu(null); if (!(event.target instanceof Element) || (!event.target.closest('[data-salon-item]') && !event.target.closest('.cursor-grab'))) setSelectedSalonItem(null); }}
        onContextMenu={(event) => event.preventDefault()}
        style={{
          height:     '100%',
          backgroundColor: '#0b0f0c',
          backgroundImage: 'linear-gradient(rgba(126,217,87,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(126,217,87,0.045) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          border:     '1px solid #1a1a1a',
        }}
      >
        {activeSection && <div className="fixed left-28 top-28 z-[60] rounded-xl border border-[#2b3a2f] bg-[#151a16]/90 px-3 py-2 shadow-lg backdrop-blur-xl"><p className="text-[10px] uppercase tracking-[0.18em] text-[#708375]">Sección activa</p><p className="mt-0.5 text-sm font-semibold text-[#b7f397]">{activeSection}</p></div>}
        <div className="fixed bottom-5 left-28 z-[90] flex items-center gap-1 rounded-2xl border border-[#2b3a2f] bg-[#151a16]/95 p-1.5 shadow-xl backdrop-blur-xl">
          <button onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))} className="h-9 w-9 rounded-xl text-lg text-[#829487] hover:bg-[#7ed957]/10 hover:text-[#b7f397]" aria-label="Alejar plano">−</button>
          <span className="min-w-12 text-center text-[11px] font-mono text-[#829487]">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))} className="h-9 w-9 rounded-xl text-lg text-[#829487] hover:bg-[#7ed957]/10 hover:text-[#b7f397]" aria-label="Acercar plano">+</button>
          <button onClick={() => setZoom(1)} className="rounded-xl px-2.5 py-2 text-[11px] text-[#829487] hover:bg-white/5 hover:text-white">Reset</button>
        </div>
        <div
          style={{
            width:           CANVAS_W,
            height:          CANVAS_H,
            transform:       `translate(${pan.x}px, ${pan.y}px) scale(${canvasScale})`,
            transformOrigin: 'top left',
            position:        'relative',
          }}
        >
          {/* Plano SVG de fondo */}
          <EditorGridSVG />

          {/* Líneas conectoras entre mesas unidas */}
          {connectorLines.length > 0 && (
            <svg
              width={CANVAS_W}
              height={CANVAS_H}
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 1 }}
            >
              {connectorLines}
            </svg>
          )}

          {/* Mesas posicionadas absolutamente */}
          {visibleMesas.map((mesa) => {
            const pos = positions.get(mesa.id) ?? { x: 60, y: 260 };

            return (
              <motion.div
                key={mesa.id}
                onContextMenu={(event) => handleMesaContextMenu(event, mesa)}
                drag={editMode && !previewMode}
                dragMomentum={false}
                dragElastic={0}
                onDragEnd={(_, info) =>
                  handleDragEnd(mesa.id, pos, info.offset.x / canvasScale, info.offset.y / canvasScale)
                }
                style={{
                  position: 'absolute',
                  left:     pos.x,
                  top:      pos.y,
                  cursor:   editMode && !previewMode ? 'grab' : 'default',
                  zIndex:   editMode && !previewMode ? 10 : 1,
                  touchAction: editMode && !previewMode ? 'none' : 'auto',
                }}
                whileDrag={{ scale: 1.06, zIndex: 20, cursor: 'grabbing' }}
              >
                <MesaCard
                  mesa={mesa}
                  isSelected={mesasSeleccionadas.includes(mesa.id)}
                  isMergeMode={isSelectionMode && !editMode}
                  isMergeSelected={mergeSelectedIds.includes(mesa.id)}
                  isSelectable={esElegibleParaUnir(mesa)}
                  isMozoRequerido={mozoRequeridoIds.has(mesa.id)}
                  mesasUnidasNums={getMesasUnidasNums(mesa)}
                  gestures={editMode && !previewMode ? NOOP_GESTURES : gestures}
                  onDelete={onDelete}
                  formaOverride={tableShapes[mesa.numero]}
                  hideChairs={salonItems.filter((item) => item.type === 'silla' && item.tableId === mesa.id).length >= mesa.capacidad}
                />
              </motion.div>
            );
          })}

          {editMode && salonItems.filter((item) => item.type !== 'zona' && (!activeSection || item.zoneName === activeSection)).map(renderSalonItem)}
          {editMode && selectedItem && selectedItem.type !== 'zona' && <div data-salon-item className="absolute border border-[#7ed957] pointer-events-none" style={{ left: selectedItem.x, top: selectedItem.y, width: selectedItem.width ?? (selectedItem.type === 'pared' ? 176 : selectedItem.type === 'sillon' ? 72 : 24), height: selectedItem.height ?? (selectedItem.type === 'pared' ? 12 : selectedItem.type === 'sillon' ? 42 : 24), zIndex: 40, transform: `rotate(${selectedItem.rotation ?? 0}deg)` }}>
            {[['nw', '-left-2 -top-2 cursor-nwse-resize'], ['n', 'left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize'], ['ne', '-right-2 -top-2 cursor-nesw-resize'], ['e', '-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize'], ['se', '-right-2 -bottom-2 cursor-nwse-resize'], ['s', 'left-1/2 -bottom-2 -translate-x-1/2 cursor-ns-resize'], ['sw', '-left-2 -bottom-2 cursor-nesw-resize'], ['w', '-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize']].map(([direction, classes]) => <button key={direction} onPointerDown={(event) => beginResize(event, selectedItem, direction)} className={`pointer-events-auto absolute h-4 w-4 rounded-sm border-2 border-[#7ed957] bg-white ${classes}`} aria-label={`Redimensionar ${direction}`} />)}
            <button onClick={(event) => { event.stopPropagation(); commitSalonItems(salonItems.map((item) => item.id === selectedItem.id ? { ...item, rotation: (item.rotation ?? 0) + 15 } : item)); }} className="pointer-events-auto absolute left-1/2 -top-12 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-[#7ed957] bg-[#151a16] text-[#b7f397] shadow-lg" title="Rotar">↻</button>
            <button onClick={(event) => { event.stopPropagation(); removeSelectedSalonItem(); }} className="pointer-events-auto absolute -right-3 -top-12 flex h-8 w-8 items-center justify-center rounded-full border border-red-400/40 bg-[#151a16] text-red-300 shadow-lg" title="Eliminar">×</button>
          </div>}

          {/* Overlay de modo edición */}
          {editMode && false && (
            <div
              className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none"
              style={{ zIndex: 30 }}
            >
              <div className="flex items-center gap-2 bg-amber-600/20 border border-amber-500/40 rounded-full px-4 py-1.5">
                <Move size={11} className="text-amber-400" />
                <span className="text-amber-400 text-xs font-semibold">
                  Arrastrá las mesas para reposicionarlas
                </span>
              </div>
            </div>
          )}

          {/* Modo selección de unión — banner indicador sobre las mesas */}
          {isSelectionMode && !editMode && (
            <div
              className="absolute top-5 left-1/2 -translate-x-1/2 pointer-events-none"
              style={{ zIndex: 30 }}
            >
              <div className="flex items-center gap-2.5 bg-[#0d0d0d] border border-amber-500/60 rounded-2xl px-5 py-3 shadow-xl shadow-black/60">
                <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-400 text-sm font-black">✓</span>
                </div>
                <div>
                  <p className="text-white text-sm font-bold leading-tight">
                    Modo selección: elegí las mesas a unir
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Tocá 2 o más mesas · las mesas ya unidas no se pueden seleccionar
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {editMode && paletteOpen && !previewMode && <SalonEditorPalette onRemoveSelected={removeSelectedSalonItem} hasSelection={Boolean(selectedSalonItem)} onCreateMesa={onCreateMesa} onAddItem={addSalonItemAtCenter} onAddMesa={addMesaFromShape} />}
      {editMode && sectionsOpen && !previewMode && <aside className="fixed right-0 top-24 bottom-0 z-[75] w-72 overflow-y-auto border-l border-[#2b3a2f] bg-[#111612]/98 p-5 shadow-2xl backdrop-blur-xl"><div className="mb-6"><p className="text-white text-sm font-semibold">Secciones del plano</p><p className="mt-1 text-xs text-[#708375]">Cada sección tiene su propio viewport.</p></div><div className="space-y-2">{sections.map((section) => <button key={section} onClick={() => setActiveSection(section)} className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition ${activeSection === section ? 'border-[#7ed957] bg-[#7ed957]/10 text-[#b7f397]' : 'border-[#2b3a2f] text-[#c5cec6] hover:border-[#7ed957]/50'}`}>{section}</button>)}</div><div className="mt-6 border-t border-[#26362a] pt-5"><p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[#708375]">Nueva sección</p><input value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} placeholder="Nombre del salón" className="w-full rounded-xl border border-[#2b3a2f] bg-[#182019] px-3 py-3 text-sm text-white outline-none focus:border-[#7ed957]" /><button onClick={() => { const name = newSectionName.trim(); if (!name) return; const id = `zona-${Date.now()}`; commitSalonItems([...salonItems, { id, type: 'zona', x: snapToGrid(CANVAS_W / 2 - 160), y: snapToGrid(CANVAS_H / 2 - 100), zoneName: name, width: 320, height: 200 }]); setActiveSection(name); setNewSectionName(''); }} className="mt-3 w-full rounded-xl bg-[#7ed957] px-4 py-3 text-sm font-semibold text-[#0e0e0e]">+ Crear sección</button></div></aside>}
      {contextMenu && <div className="fixed z-[200] w-60 rounded-2xl border border-[#2b3a2f] bg-[#151a16] p-2 shadow-2xl shadow-black/50" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-[#2b3a2f] px-3 py-2 mb-1"><p className="text-white text-sm font-semibold">Mesa {contextMenu.mesa.numero}</p><p className="text-[#708375] text-xs mt-1">{contextMenu.mesa.zona}</p></div>
        <button onClick={() => { setEditingMesa(contextMenu.mesa); setEditingNumber(String(contextMenu.mesa.numero)); setEditingCapacity(String(contextMenu.mesa.capacidad)); setContextMenu(null); }} className="w-full rounded-xl px-3 py-3 text-left text-sm text-[#c1c8c2] hover:bg-[#7ed957]/10 hover:text-[#b7f397]">Editar mesa</button>
        <button onClick={() => { setEditMode(true); setContextMenu(null); }} className="w-full rounded-xl px-3 py-3 text-left text-sm text-[#c1c8c2] hover:bg-[#7ed957]/10 hover:text-[#b7f397]">Mover en el plano</button>
        <button onClick={() => { onDelete(contextMenu.mesa.id); setContextMenu(null); }} className="w-full rounded-xl px-3 py-3 text-left text-sm text-red-300 hover:bg-red-500/10">Eliminar mesa</button>
        <button onClick={() => setContextMenu(null)} className="w-full rounded-xl px-3 py-3 text-left text-sm text-[#708375] hover:bg-white/5">Cancelar</button>
      </div>}
      {chairToAssign && <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-3xl border border-[#2b3a2f] bg-[#151a16] p-6 shadow-2xl"><h3 className="text-lg font-semibold text-white">¿A qué mesa pertenece?</h3><p className="mt-2 text-sm text-[#829487]">Elegí la mesa para asociar esta silla.</p><div className="mt-5 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">{mesas.map((mesa) => <button key={mesa.id} onClick={() => { commitSalonItems(salonItems.map((item) => item.id === chairToAssign ? { ...item, tableId: mesa.id } : item)); setChairToAssign(null); }} className="rounded-xl border border-[#2b3a2f] px-3 py-3 text-left text-sm text-white hover:border-[#7ed957] hover:bg-[#7ed957]/10">Mesa {mesa.numero}<span className="block text-xs text-[#708375] mt-1">{mesa.zona}</span></button>)}</div><button onClick={() => setChairToAssign(null)} className="mt-5 w-full rounded-xl px-4 py-2.5 text-sm text-[#829487] hover:bg-white/5">Cancelar</button></div></div>}
    {/* modal follows */}
      {zoneDraft && <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm rounded-3xl border border-[#2b3a2f] bg-[#151a16] p-6 shadow-2xl"><h3 className="text-lg font-semibold text-white">Nueva sección / salón</h3><p className="mt-2 text-sm text-[#829487]">Los objetos colocados dentro pertenecerán a este plano.</p><input autoFocus value={zoneName} onChange={(event) => setZoneName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && createZone()} placeholder="Nombre de la sección" className="mt-5 w-full rounded-xl border border-[#2b3a2f] bg-[#182019] px-3 py-3 text-sm text-white" /><div className="mt-5 flex gap-2"><button onClick={createZone} className="flex-1 rounded-xl bg-[#7ed957] px-4 py-3 text-sm font-semibold text-[#0e0e0e]">Crear sección</button><button onClick={() => setZoneDraft(false)} className="rounded-xl px-4 py-3 text-sm text-[#829487]">Cancelar</button></div></div></div>}
      {tableDraft && <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm rounded-3xl border border-[#2b3a2f] bg-[#151a16] p-6 shadow-2xl"><h3 className="text-lg font-semibold text-white">Crear mesa</h3><p className="mt-2 text-sm text-[#829487]">Número y capacidad inicial.</p><div className="mt-5 grid grid-cols-2 gap-3"><input autoFocus value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} type="number" placeholder="N° mesa" className="rounded-xl border border-[#2b3a2f] bg-[#182019] px-3 py-3 text-sm text-white" /><input value={tableCapacity} onChange={(event) => setTableCapacity(event.target.value)} type="number" min="1" placeholder="Sillas" className="rounded-xl border border-[#2b3a2f] bg-[#182019] px-3 py-3 text-sm text-white" /></div><div className="mt-5 flex gap-2"><button onClick={() => { const number = Number(tableNumber); if (!number) return; setTableShapes((current) => ({ ...current, [number]: tableDraft === 'mesa-redonda' ? 'circular' : 'rectangular' })); onCreateMesa(number, Number(tableCapacity) || 4); setTableDraft(null); setTableNumber(''); }} className="flex-1 rounded-xl bg-[#7ed957] px-4 py-3 text-sm font-semibold text-[#0e0e0e]">Crear mesa</button><button onClick={() => setTableDraft(null)} className="rounded-xl px-4 py-3 text-sm text-[#829487]">Cancelar</button></div></div></div>}
      {editingMesa && <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-sm rounded-3xl border border-[#2b3a2f] bg-[#151a16] p-6 shadow-2xl"><h3 className="text-lg font-semibold text-white">Editar mesa</h3><div className="mt-5 space-y-3"><input autoFocus value={editingNumber} onChange={(event) => setEditingNumber(event.target.value)} type="number" className="w-full rounded-xl border border-[#2b3a2f] bg-[#182019] px-3 py-3 text-sm text-white" placeholder="Número de mesa" /><input value={editingCapacity} onChange={(event) => setEditingCapacity(event.target.value)} type="number" min="1" className="w-full rounded-xl border border-[#2b3a2f] bg-[#182019] px-3 py-3 text-sm text-white" placeholder="Capacidad" /></div><div className="mt-5 flex gap-2"><button onClick={async () => { const numero = Number(editingNumber); const capacidad = Number(editingCapacity); if (!numero || !capacidad) return; await editarMesa(editingMesa.id, { numero, capacidad }); setEditingMesa(null); }} className="flex-1 rounded-xl bg-[#7ed957] px-4 py-3 text-sm font-semibold text-[#0e0e0e]">Guardar cambios</button><button onClick={() => setEditingMesa(null)} className="rounded-xl px-4 py-3 text-sm text-[#829487]">Cancelar</button></div></div></div>}
    </div>
  );
});

// ── Plano SVG de fondo ────────────────────────────────────────────────────────
function EditorGridSVG() {
  return <svg width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="absolute inset-0" style={{ pointerEvents: 'none', userSelect: 'none' }}>
    <defs><pattern id="only-editor-grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M 16 0 L 0 0 0 16" fill="none" stroke="#26362a" strokeWidth="0.6" opacity="0.65" /></pattern></defs>
    <rect width={CANVAS_W} height={CANVAS_H} fill="#0b0f0c" />
    <rect width={CANVAS_W} height={CANVAS_H} fill="url(#only-editor-grid)" />
  </svg>;
}

function FloorPlanSVG() {
  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      className="absolute inset-0"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <defs>
        <pattern id="editor-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#26362a" strokeWidth="0.7" opacity="0.55" />
        </pattern>
        {/* Trama diagonal para terraza exterior */}
        <pattern id="terraza-hatch" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="24" stroke="rgba(255,255,255,0.018)" strokeWidth="10" />
        </pattern>

        {/* Trama de cocina */}
        <pattern id="cocina-hatch" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 14 L14 0" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
          <path d="M-7 7 L7 -7" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
          <path d="M7 21 L21 7" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
        </pattern>

        {/* Sombra de pared */}
        <filter id="wall-shadow">
          <feDropShadow dx="1" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* ── Rellenos de zona ─────────────────────────────────────────────── */}

      {/* Terraza (exterior) */}
      <rect x={0} y={0} width={1600} height={220} fill="url(#terraza-hatch)" />
      <rect x={0} y={0} width={1600} height={220} fill="rgba(56,189,248,0.012)" />

      {/* Salón principal */}
      <rect x={0} y={220} width={1120} height={480} fill="rgba(255,255,255,0.008)" />

      {/* Bar */}
      <rect x={1120} y={220} width={480} height={310} fill="rgba(217,119,6,0.025)" />

      {/* Zona cocina (servicio — sin acceso) */}
      <rect x={1120} y={530} width={480} height={170} fill="rgba(0,0,0,0.45)" />
      <rect x={1120} y={530} width={480} height={170} fill="url(#cocina-hatch)" />

      {/* Zona sofás */}
      <rect x={0} y={700} width={620} height={170} fill="rgba(139,92,246,0.018)" />

      {/* En modo editor el plano parte de un lienzo neutro: las paredes y zonas
          se agregan desde la biblioteca, en lugar de venir dibujadas de fábrica. */}
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#0b0f0c" />
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="url(#editor-grid)" opacity="0.8" />

      {/* ── Paredes exteriores ────────────────────────────────────────────── */}

      {/* Pared superior */}
      <line x1={0} y1={0} x2={1600} y2={0} stroke="#3f3f46" strokeWidth={5} />
      {/* Pared izquierda */}
      <line x1={0} y1={0} x2={0} y2={870} stroke="#3f3f46" strokeWidth={5} />
      {/* Pared derecha */}
      <line x1={1600} y1={0} x2={1600} y2={870} stroke="#3f3f46" strokeWidth={5} />
      {/* Pared inferior — con hueco de entrada */}
      <line x1={0} y1={870} x2={680} y2={870} stroke="#3f3f46" strokeWidth={5} />
      <line x1={820} y1={870} x2={1600} y2={870} stroke="#3f3f46" strokeWidth={5} />

      {/* ── Divisores internos ───────────────────────────────────────────── */}

      {/* Terraza / interior — línea punteada */}
      <line x1={0} y1={220} x2={1600} y2={220} stroke="#3f3f46" strokeWidth={2} strokeDasharray="10 5" />

      {/* Salón / BAR+COCINA vertical */}
      <line x1={1120} y1={220} x2={1120} y2={700} stroke="#3f3f46" strokeWidth={3} />

      {/* BAR / COCINA horizontal */}
      <line x1={1120} y1={530} x2={1600} y2={530} stroke="#3f3f46" strokeWidth={2.5} />

      {/* Sofás / salón sur */}
      <line x1={620} y1={700} x2={620} y2={870} stroke="#2d2d2d" strokeWidth={1.5} />
      <line x1={0} y1={700} x2={1120} y2={700} stroke="#2d2d2d" strokeWidth={1.5} strokeDasharray="6 4" />

      {/* ── Columnas estructurales ───────────────────────────────────────── */}
      {[
        [0, 220], [1120, 220], [1600, 220],
        [0, 700], [620, 700], [1120, 700],
      ].map(([cx, cy], i) => (
        <g key={i} transform={`translate(${cx}, ${cy})`}>
          <rect x={-8} y={-8} width={16} height={16} fill="#1a1a1a" stroke="#52525b" strokeWidth={1.5} />
        </g>
      ))}

      {/* ── Etiqueta de terraza ───────────────────────────────────────────── */}
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#0b0f0c" />
      <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="url(#editor-grid)" opacity="0.8" />
      <text
        x={800} y={130}
        textAnchor="middle" fill="#2a2a2a"
        fontFamily="monospace" fontSize={13}
        letterSpacing={8} fontWeight={600}
      >
        TERRAZA EXTERIOR
      </text>
      {/* Línea decorativa bajo etiqueta terraza */}
      <line x1={600} y1={140} x2={1000} y2={140} stroke="#2a2a2a" strokeWidth={0.8} />

      {/* ── Etiqueta salón principal ─────────────────────────────────────── */}
      <text
        x={560} y={688}
        textAnchor="middle" fill="#2a2a2a"
        fontFamily="monospace" fontSize={10}
        letterSpacing={5}
      >
        SALÓN PRINCIPAL
      </text>

      {/* ── Etiqueta BAR ─────────────────────────────────────────────────── */}
      {/* Mostrador del bar */}
      <rect x={1140} y={480} width={440} height={18} rx={4} fill="#1a1a1a" stroke="#3f3f46" strokeWidth={1} />
      <text
        x={1360} y={510}
        textAnchor="middle" fill="#2a2a2a"
        fontFamily="monospace" fontSize={10}
        letterSpacing={5}
      >
        BAR
      </text>

      {/* ── Etiqueta ZONA COCINA ─────────────────────────────────────────── */}
      {/* Ícono de cocina */}
      <rect x={1230} y={570} width={260} height={100} rx={6} fill="#111" stroke="#2a2a2a" strokeWidth={1} />
      <text
        x={1360} y={612}
        textAnchor="middle" fill="#2a2a2a"
        fontFamily="monospace" fontSize={10}
        letterSpacing={4}
      >
        ZONA COCINA
      </text>
      <text
        x={1360} y={632}
        textAnchor="middle" fill="#222222"
        fontFamily="monospace" fontSize={8}
        letterSpacing={3}
      >
        (servicio)
      </text>

      {/* ── Etiqueta ZONA SOFÁS ──────────────────────────────────────────── */}
      <text
        x={310} y={858}
        textAnchor="middle" fill="#2a2a2a"
        fontFamily="monospace" fontSize={10}
        letterSpacing={5}
      >
        ZONA SOFÁS
      </text>

      {/* ── Indicador de entrada ─────────────────────────────────────────── */}
      {/* Arco de puerta */}
      <path
        d="M 680 870 Q 750 820 820 870"
        fill="none" stroke="#52525b" strokeWidth={1.5} strokeDasharray="5 3"
      />
      <text
        x={750} y={855}
        textAnchor="middle" fill="#3f3f46"
        fontFamily="monospace" fontSize={9}
        letterSpacing={4}
      >
        ENTRADA
      </text>
      {/* Flechas de entrada */}
      <line x1={750} y1={862} x2={750} y2={840} stroke="#3f3f46" strokeWidth={1} />
      <polygon points="750,870 745,862 755,862" fill="#3f3f46" opacity={0.6} />

      {/* ── Ventanas en terraza ───────────────────────────────────────────── */}
      {[120, 420, 720, 1020, 1320].map((wx) => (
        <g key={wx}>
          <rect x={wx} y={0} width={80} height={8} fill="#1e293b" stroke="#334155" strokeWidth={1} />
          <line x1={wx + 40} y1={0} x2={wx + 40} y2={8} stroke="#334155" strokeWidth={0.8} />
        </g>
      ))}

      {/* ── Barra de escala ──────────────────────────────────────────────── */}
      <g transform="translate(28, 845)" opacity={0.4}>
        <line x1={0} y1={0} x2={80} y2={0} stroke="#52525b" strokeWidth={1} />
        <line x1={0} y1={-4} x2={0} y2={4} stroke="#52525b" strokeWidth={1} />
        <line x1={80} y1={-4} x2={80} y2={4} stroke="#52525b" strokeWidth={1} />
        <text x={40} y={-7} textAnchor="middle" fill="#52525b" fontFamily="monospace" fontSize={7} letterSpacing={1}>
          ESC.
        </text>
      </g>

      {/* ── Norte indicador ──────────────────────────────────────────────── */}
      <g transform="translate(1555, 32)" opacity={0.4}>
        <circle cx={0} cy={0} r={14} fill="none" stroke="#52525b" strokeWidth={1} />
        <polygon points="0,-12 -5,4 0,1 5,4" fill="#52525b" />
        <text x={0} y={25} textAnchor="middle" fill="#52525b" fontFamily="monospace" fontSize={8}>N</text>
      </g>
    </svg>
  );
}
