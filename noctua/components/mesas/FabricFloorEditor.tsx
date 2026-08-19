'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, Circle, Rect, Textbox, Group, FabricObject, Point, FabricImage, ActiveSelection, util } from 'fabric';
import { Hand, MousePointer2, Save, Trash2, ZoomIn, ZoomOut, Square, Undo2, Redo2, Shapes, X, ImagePlus, Pencil, Eye, Layers3, Plus, Copy, ClipboardPaste, Link2, Unlink } from 'lucide-react';
import type { Mesa } from '@/types/mesa';

interface FabricFloorEditorProps {
  mesas: Mesa[];
  onDelete: (id: string) => void;
  onCreateMesa: (numero?: number, capacidad?: number) => void;
  onUpdateMesaCapacity: (id: string, capacity: number) => void;
}

type Tool = 'select' | 'hand';

const STORAGE_KEY = 'vase-rest-fabric-floor-document-v2';

function getData(object: FabricObject): Record<string, unknown> {
  return (object.get('data') as Record<string, unknown> | undefined) ?? {};
}

function styleObject(object: FabricObject) {
  object.set({ cornerColor: '#7ed957', cornerStrokeColor: '#101510', borderColor: '#7ed957', cornerSize: 10, transparentCorners: false, padding: 6 });
}

function setObjectData(object: FabricObject, data: Record<string, unknown>) {
  object.set('data' as never, data as never);
}

function makeChair(x: number, y: number, tableId?: string) {
  const chair = new Group([
    new Rect({ left: -15, top: -13, width: 30, height: 29, rx: 8, ry: 8, fill: '#2f4437', stroke: '#91aa99', strokeWidth: 1.5 }),
    new Rect({ left: -12, top: -10, width: 24, height: 21, rx: 6, ry: 6, fill: '#3d5847', stroke: '#607a69', strokeWidth: 1 }),
    new Rect({ left: -16, top: -19, width: 32, height: 9, rx: 5, ry: 5, fill: '#789181', stroke: '#b7c8bc', strokeWidth: 1.5 }),
  ], { left: x, top: y, objectCaching: false });
  setObjectData(chair, { kind: 'chair', tableId: tableId ?? null });
  styleObject(chair);
  return chair;
}

function makeSofa(x: number, y: number) {
  const sofa = new Group([
    new Rect({ left: -52, top: -24, width: 104, height: 50, rx: 15, ry: 15, fill: '#26382e', stroke: '#8fa897', strokeWidth: 2 }),
    new Rect({ left: -40, top: -15, width: 80, height: 34, rx: 11, ry: 11, fill: '#3b5545', stroke: '#66806e', strokeWidth: 1.25 }),
    new Rect({ left: -43, top: -24, width: 86, height: 12, rx: 7, ry: 7, fill: '#536f5d', stroke: '#a9beaf', strokeWidth: 1.5 }),
    new Rect({ left: -52, top: -15, width: 15, height: 39, rx: 8, ry: 8, fill: '#405b49', stroke: '#91aa99', strokeWidth: 1.5 }),
    new Rect({ left: 37, top: -15, width: 15, height: 39, rx: 8, ry: 8, fill: '#405b49', stroke: '#91aa99', strokeWidth: 1.5 }),
    new Rect({ left: -1, top: -12, width: 2, height: 28, rx: 1, ry: 1, fill: '#26382e' }),
  ], { left: x, top: y, objectCaching: false });
  setObjectData(sofa, { kind: 'sofa' });
  styleObject(sofa);
  return sofa;
}

function refreshFurnitureDesign(canvas: Canvas) {
  [...canvas.getObjects()].forEach((object) => {
    const data = getData(object);
    if (data.kind === 'tableGroup') {
      const round = data.shape !== 'rectangular';
      const surface = round
        ? new Circle({ left: 0, top: 0, originX: 'center', originY: 'center', radius: 46, fill: '#211b17', stroke: '#7ed957', strokeWidth: 2.5 })
        : new Rect({ left: 0, top: 0, originX: 'center', originY: 'center', width: 124, height: 78, rx: 18, ry: 18, fill: '#211b17', stroke: '#7ed957', strokeWidth: 2.5 });
      const inset = round
        ? new Circle({ left: 0, top: 0, originX: 'center', originY: 'center', radius: 38, fill: '#30251e', stroke: '#564337', strokeWidth: 1 })
        : new Rect({ left: 0, top: 0, originX: 'center', originY: 'center', width: 108, height: 62, rx: 13, ry: 13, fill: '#30251e', stroke: '#564337', strokeWidth: 1 });
      const label = new Textbox(String(data.mesaNumero ?? ''), { left: 0, top: 0, originX: 'center', originY: 'center', width: 44, fontSize: 26, fontWeight: '700', fill: '#fff', textAlign: 'center', selectable: false, evented: false });
      const replacement = new Group([surface, inset, label], { left: object.left, top: object.top, originX: object.originX, originY: object.originY, angle: object.angle, scaleX: object.scaleX, scaleY: object.scaleY, objectCaching: false });
      setObjectData(replacement, data);
      styleObject(replacement);
      const index = canvas.getObjects().indexOf(object);
      canvas.remove(object);
      canvas.insertAt(index, replacement);
      replacement.setCoords();
      return;
    }
    if (data.kind !== 'chair' && data.kind !== 'sofa') return;
    const index = canvas.getObjects().indexOf(object);
    const replacement = data.kind === 'chair'
      ? makeChair(object.left ?? 0, object.top ?? 0)
      : makeSofa(object.left ?? 0, object.top ?? 0);
    replacement.set({
      angle: object.angle,
      scaleX: object.scaleX,
      scaleY: object.scaleY,
      flipX: object.flipX,
      flipY: object.flipY,
    });
    setObjectData(replacement, data);
    canvas.remove(object);
    canvas.insertAt(index, replacement);
    replacement.setCoords();
  });
}

export function FabricFloorEditor({ mesas, onDelete, onCreateMesa, onUpdateMesaCapacity }: FabricFloorEditorProps) {
  const router = useRouter();
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [selected, setSelected] = useState<FabricObject | null>(null);
  const [selectedObjects, setSelectedObjects] = useState<FabricObject[]>([]);
  const [zoom, setZoom] = useState(1);
  const [tableNumber, setTableNumber] = useState('');
  const [tableDraft, setTableDraft] = useState<'round' | 'rectangular' | null>(null);
  const [status, setStatus] = useState('Sin cambios');
  const [canvasReady, setCanvasReady] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [sections, setSections] = useState(['Salón principal']);
  const [activeSection, setActiveSection] = useState('Salón principal');
  const [newSectionName, setNewSectionName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: FabricObject | null } | null>(null);
  const [previewInfo, setPreviewInfo] = useState<{ numero: number; capacidad: number; x: number; y: number } | null>(null);
  const [pendingLink, setPendingLink] = useState<{ chair: FabricObject; table: FabricObject } | null>(null);
  const [sofaCapacityDraft, setSofaCapacityDraft] = useState<string | null>(null);
  const [sofaAllocationDraft, setSofaAllocationDraft] = useState<{ sofa: FabricObject; tables: FabricObject[]; allocations: Record<string, string> } | null>(null);
  const [dragOverCanvas, setDragOverCanvas] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef(false);
  const toolRef = useRef<Tool>('select');
  const editorModeRef = useRef<'edit' | 'preview'>('edit');
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const previousPositions = useRef(new Map<FabricObject, { left?: number; top?: number; angle?: number }>());
  const lastMesasCountRef = useRef(0);
  const mesasRef = useRef(mesas);
  const updateCapacityRef = useRef(onUpdateMesaCapacity);
  const clipboardRef = useRef<FabricObject[]>([]);
  const pendingDropPointRef = useRef<Point | null>(null);

  const pushHistorySnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const snapshot = JSON.stringify((canvas.toJSON as unknown as (properties?: string[]) => unknown)(['data']));
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    if (history[history.length - 1] === snapshot) return;
    historyRef.current = [...history, snapshot].slice(-50);
    historyIndexRef.current = historyRef.current.length - 1;
  };

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { editorModeRef.current = editorMode; }, [editorMode]);
  useEffect(() => { mesasRef.current = mesas; }, [mesas]);
  useEffect(() => { updateCapacityRef.current = onUpdateMesaCapacity; }, [onUpdateMesaCapacity]);

  useEffect(() => {
    const savedSections = window.localStorage.getItem(`${STORAGE_KEY}:sections`);
    if (!savedSections) return;
    try {
      const parsed = JSON.parse(savedSections) as string[];
      if (Array.isArray(parsed) && parsed.length) setSections(parsed);
    } catch { /* Se conserva la sección inicial si el dato local está dañado. */ }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const editing = editorMode === 'edit';
    canvas.selection = editing;
    canvas.getObjects().forEach((object) => object.set({ selectable: editing, evented: true }));
    if (!editing) canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, [editorMode]);

  useEffect(() => {
    if (!canvasElement.current || canvasRef.current) return;
    const canvas = new Canvas(canvasElement.current, { backgroundColor: '#0b0f0c', preserveObjectStacking: true, selection: true });
    canvasRef.current = canvas;
    const preventNativeMenu = (event: MouseEvent) => event.preventDefault();
    canvas.upperCanvasEl.addEventListener('contextmenu', preventNativeMenu);

    const resize = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      canvas.setDimensions({ width: wrapper.clientWidth, height: wrapper.clientHeight });
      canvas.requestRenderAll();
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (wrapperRef.current) observer.observe(wrapperRef.current);

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) canvas.loadFromJSON(JSON.parse(saved)).then(() => { refreshFurnitureDesign(canvas); canvas.requestRenderAll(); hydratedRef.current = true; pushHistorySnapshot(); setCanvasReady(true); setStatus('Guardado'); });
    else { hydratedRef.current = true; setCanvasReady(true); }
    historyRef.current = [JSON.stringify((canvas.toJSON as unknown as (properties?: string[]) => unknown)(['data']))];
    historyIndexRef.current = 0;

    const onSelection = (event: { selected?: FabricObject[] }) => {
      const objects = canvas.getActiveObjects();
      setSelected(objects[0] ?? event.selected?.[0] ?? null);
      setSelectedObjects(objects.length ? objects : (event.selected ?? []));
    };
    const onCleared = () => { setSelected(null); setSelectedObjects([]); };
    const onModified = () => {
      pushHistorySnapshot();
      setStatus('Cambios sin guardar');
    };
    canvas.on('selection:created', onSelection);
    canvas.on('selection:updated', onSelection);
    canvas.on('selection:cleared', onCleared);
    canvas.on('object:modified', onModified);
    canvas.on('object:moving', (event) => {
      const object = event.target;
      if (!object) return;
      const data = getData(object);
      const previous = previousPositions.current.get(object);
      const tables = canvas.getObjects().filter((candidate) => getData(candidate).kind === 'tableGroup' && candidate !== object);
      // Sillas y sillones son mobiliario libre: pueden acercarse o superponerse
      // visualmente a una mesa sin quedar bloqueados por su caja de colisión.
      const collides = data.kind !== 'chair' && data.kind !== 'sofa' && tables.some((table) => object.intersectsWithObject(table));
      if (collides && previous) object.set({ left: previous.left, top: previous.top });
      else {
        if (data.kind === 'tableGroup' && previous) {
          const dx = (object.left ?? 0) - (previous.left ?? 0);
          const dy = (object.top ?? 0) - (previous.top ?? 0);
          const tableId = data.mesaId ?? data.mesaNumero;
          canvas.getObjects().forEach((candidate) => {
            if (getData(candidate).kind === 'chair' && getData(candidate).tableId === tableId) {
              candidate.set({ left: (candidate.left ?? 0) + dx, top: (candidate.top ?? 0) + dy });
              candidate.setCoords();
            }
          });
        }
        previousPositions.current.set(object, { left: object.left, top: object.top, angle: object.angle });
      }
      if (data.kind === 'chair') {
        const nearest = tables
          .map((table) => ({ table, distance: table.getCenterPoint().distanceFrom(object.getCenterPoint()) }))
          .sort((a, b) => a.distance - b.distance)[0];
        if (nearest && nearest.distance < 180) {
          nearest.table.set({ opacity: 0.82 });
        } else {
          tables.forEach((table) => table.set({ opacity: 1 }));
        }
      }
      canvas.requestRenderAll();
    });
    let panning = false;
    let lastPoint = { x: 0, y: 0 };
    canvas.on('mouse:down', (event) => {
      const pointer = event.e as MouseEvent;
      if (editorModeRef.current === 'edit' && pointer.button === 2) {
        pointer.preventDefault();
        setContextMenu({ x: pointer.offsetX, y: pointer.offsetY, target: event.target ?? null });
        if (event.target) canvas.setActiveObject(event.target);
        canvas.requestRenderAll();
        return;
      }
      if (editorModeRef.current === 'preview' && pointer.button === 0) {
        const data = event.target ? getData(event.target) : {};
        if (data.kind === 'tableGroup') {
          const mesaId = data.mesaId ? String(data.mesaId) : mesasRef.current.find((mesa) => mesa.numero === Number(data.mesaNumero))?.id;
          if (mesaId) {
            router.push(`/dashboard/pedido?mesa=${encodeURIComponent(mesaId)}`);
            return;
          }
          setPreviewInfo({ numero: Number(data.mesaNumero), capacidad: Number(data.capacidad ?? 0), x: pointer.offsetX, y: pointer.offsetY });
        }
        else setPreviewInfo(null);
        return;
      }
      setContextMenu(null);
      if (event.target) previousPositions.current.set(event.target, { left: event.target.left, top: event.target.top, angle: event.target.angle });
      if (toolRef.current !== 'hand') return;
      panning = true;
      const point = event.e as MouseEvent;
      lastPoint = { x: point.clientX, y: point.clientY };
      canvas.selection = false;
      canvas.discardActiveObject();
    });
    canvas.on('mouse:move', (event) => {
      if (!panning || toolRef.current !== 'hand') return;
      const pointer = event.e as MouseEvent;
      const point = { x: pointer.clientX, y: pointer.clientY };
      const transform = canvas.viewportTransform;
      if (transform) { transform[4] += point.x - lastPoint.x; transform[5] += point.y - lastPoint.y; canvas.requestRenderAll(); }
      lastPoint = point;
    });
    canvas.on('mouse:up', (event) => {
      panning = false;
      canvas.selection = true;
      const object = event.target;
      canvas.getObjects().filter((candidate) => getData(candidate).kind === 'tableGroup').forEach((candidate) => candidate.set({ opacity: 1 }));
      if (!object || getData(object).kind !== 'chair') return;
      const table = canvas.getObjects()
        .filter((candidate) => getData(candidate).kind === 'tableGroup')
        .map((candidate) => ({ candidate, distance: candidate.getCenterPoint().distanceFrom(object.getCenterPoint()) }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!table || table.distance >= 180) {
        const previousTableId = getData(object).tableId;
        if (previousTableId != null) {
          setObjectData(object, { ...getData(object), tableId: null });
          const previousTable = canvas.getObjects().find((candidate) => {
            const data = getData(candidate);
            return data.kind === 'tableGroup' && (data.mesaId ?? data.mesaNumero) === previousTableId;
          });
          if (previousTable) {
            const remaining = canvas.getObjects().filter((candidate) => candidate !== object && getData(candidate).kind === 'chair' && getData(candidate).tableId === previousTableId).length;
            const previousData = getData(previousTable);
            setObjectData(previousTable, { ...previousData, capacidad: remaining });
            const backendTable = mesasRef.current.find((mesa) => mesa.id === String(previousData.mesaId) || mesa.numero === Number(previousData.mesaNumero));
            if (backendTable) updateCapacityRef.current(backendTable.id, remaining);
          }
          setStatus('Silla desunida · cambios sin guardar');
        }
        return;
      }
      const tableData = getData(table.candidate);
      const tableId = tableData.mesaId ?? tableData.mesaNumero;
      if (getData(object).tableId === tableId) {
        setStatus(`Silla de la mesa ${tableData.mesaNumero} reposicionada`);
        return;
      }
      setPendingLink({ chair: object, table: table.candidate });
      canvas.requestRenderAll();
    });
    canvas.on('mouse:wheel', (event) => {
      const wheel = event.e;
      const next = Math.max(0.35, Math.min(2.5, canvas.getZoom() * (wheel.deltaY > 0 ? 0.92 : 1.08)));
      canvas.zoomToPoint(new Point(wheel.offsetX, wheel.offsetY), next);
      setZoom(next);
      wheel.preventDefault();
      wheel.stopPropagation();
    });
    return () => { observer.disconnect(); canvas.upperCanvasEl.removeEventListener('contextmenu', preventNativeMenu); canvas.dispose(); canvasRef.current = null; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hydratedRef.current) return;
    const canReconcileDeletions = mesas.length > 0 || lastMesasCountRef.current > 0;
    if (canReconcileDeletions) canvas.getObjects().filter((object) => getData(object).kind === 'tableGroup').forEach((object) => {
      const data = getData(object);
      const backendTable = mesas.find((mesa) => mesa.numero === Number(data.mesaNumero));
      if (backendTable) {
        const previousId = data.mesaId ?? data.mesaNumero;
        setObjectData(object, { ...data, mesaId: backendTable.id, sectionId: backendTable.zona });
        canvas.getObjects().filter((candidate) => getData(candidate).kind === 'chair' && getData(candidate).tableId === previousId).forEach((chair) => setObjectData(chair, { ...getData(chair), tableId: backendTable.id }));
        canvas.getObjects().filter((candidate) => getData(candidate).kind === 'sofa').forEach((sofa) => {
          const sofaData = getData(sofa);
          const allocations = { ...((sofaData.allocations as Record<string, number> | undefined) ?? {}) };
          if (allocations[String(previousId)] !== undefined) {
            allocations[String(backendTable.id)] = allocations[String(previousId)];
            delete allocations[String(previousId)];
            setObjectData(sofa, { ...sofaData, allocations });
          }
        });
      }
      else if (data.mesaId) {
        const tableId = data.mesaId ?? data.mesaNumero;
        canvas.getObjects().filter((candidate) => getData(candidate).kind === 'chair' && getData(candidate).tableId === tableId).forEach((chair) => setObjectData(chair, { ...getData(chair), tableId: null }));
        canvas.remove(object);
      }
    });
    lastMesasCountRef.current = mesas.length;
    if (mesas.length === 0) { canvas.requestRenderAll(); return; }
    const existingNumbers = new Set(canvas.getObjects().map((object) => getData(object).mesaNumero).filter(Boolean));
    const newTables = mesas.filter((mesa) => !existingNumbers.has(mesa.numero));
    if (newTables.length === 0) return;
    newTables.forEach((mesa, index) => {
      const position = mesa.posicion.x > 20 || mesa.posicion.y > 20 ? mesa.posicion : { x: 140 + index * 220, y: 160 };
      const objects: FabricObject[] = [new Circle({ left: 0, top: 0, originX: 'center', originY: 'center', radius: 46, fill: '#211b17', stroke: '#7ed957', strokeWidth: 2.5 }), new Circle({ left: 0, top: 0, originX: 'center', originY: 'center', radius: 38, fill: '#30251e', stroke: '#564337', strokeWidth: 1 }), new Textbox(String(mesa.numero), { left: 0, top: 0, originX: 'center', originY: 'center', width: 44, fontSize: 26, fontWeight: '700', fill: '#fff', textAlign: 'center', selectable: false, evented: false })];
      const group = new Group(objects, { left: position.x + 80, top: position.y + 80, originX: 'center', originY: 'center', subTargetCheck: false, interactive: false, objectCaching: false });
      setObjectData(group, { kind: 'tableGroup', mesaId: mesa.id, mesaNumero: mesa.numero, capacidad: 0, sectionId: mesa.zona, shape: 'round' });
      styleObject(group);
      canvas.add(group);
    });
    canvas.requestRenderAll();
  }, [canvasReady, mesas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hydratedRef.current) return;
    mesas.forEach((mesa) => {
      const relatedChairs = canvas.getObjects().filter((object) => getData(object).kind === 'chair' && (getData(object).tableId === mesa.id || getData(object).tableId === mesa.numero)).length;
      const sofaPlaces = canvas.getObjects().filter((object) => getData(object).kind === 'sofa').reduce((total, sofa) => {
        const allocations = (getData(sofa).allocations as Record<string, number> | undefined) ?? {};
        return total + Number(allocations[String(mesa.id)] ?? allocations[String(mesa.numero)] ?? 0);
      }, 0);
      const actualCapacity = relatedChairs + sofaPlaces;
      if (mesa.capacidad !== actualCapacity) onUpdateMesaCapacity(mesa.id, actualCapacity);
    });
  }, [canvasReady, mesas, onUpdateMesaCapacity]);

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const serialized = (canvas.toJSON as unknown as (properties?: string[]) => unknown)(['data']);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    window.localStorage.setItem(`${STORAGE_KEY}:section:${activeSection}`, JSON.stringify(serialized));
    window.localStorage.setItem(`${STORAGE_KEY}:sections`, JSON.stringify(sections));
    setStatus('Guardado');
  };

  const switchSection = async (nextSection: string) => {
    const canvas = canvasRef.current;
    if (!canvas || nextSection === activeSection) return;
    const current = (canvas.toJSON as unknown as (properties?: string[]) => unknown)(['data']);
    window.localStorage.setItem(`${STORAGE_KEY}:section:${activeSection}`, JSON.stringify(current));
    const next = window.localStorage.getItem(`${STORAGE_KEY}:section:${nextSection}`);
    canvas.discardActiveObject();
    if (next) { await canvas.loadFromJSON(JSON.parse(next)); refreshFurnitureDesign(canvas); }
    else canvas.clear();
    canvas.backgroundColor = '#0b0f0c';
    canvas.requestRenderAll();
    setSelected(null);
    setActiveSection(nextSection);
    setStatus(`Sección: ${nextSection}`);
  };

  const createSection = async () => {
    const name = newSectionName.trim();
    if (!name || sections.some((section) => section.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
    const nextSections = [...sections, name];
    setSections(nextSections);
    setNewSectionName('');
    window.localStorage.setItem(`${STORAGE_KEY}:sections`, JSON.stringify(nextSections));
    await switchSection(name);
  };

  const addObject = (kind: 'chair' | 'sofa' | 'wall', dropPoint?: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (kind === 'sofa') { pendingDropPointRef.current = dropPoint ?? null; setSofaCapacityDraft('3'); return; }
    const center = dropPoint ?? canvas.getVpCenter();
    let object: FabricObject;
    if (kind === 'chair') object = makeChair(center.x - 12, center.y - 11);
    else { object = new Rect({ left: center.x - 100, top: center.y - 6, width: 200, height: 12, fill: '#66726a', stroke: '#a9b8ad', strokeWidth: 1 }); setObjectData(object, { kind: 'wall' }); }
    styleObject(object);
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    setStatus('Cambios sin guardar');
  };

  const createSofa = () => {
    const canvas = canvasRef.current;
    const capacity = Number(sofaCapacityDraft);
    if (!canvas || !Number.isInteger(capacity) || capacity < 1) return;
    const center = pendingDropPointRef.current ?? canvas.getVpCenter();
    const sofa = makeSofa(center.x, center.y);
    setObjectData(sofa, { kind: 'sofa', capacity, allocations: {} });
    canvas.add(sofa);
    canvas.setActiveObject(sofa);
    canvas.requestRenderAll();
    pushHistorySnapshot();
    pendingDropPointRef.current = null;
    setSofaCapacityDraft(null);
    setStatus(`Sillón de ${capacity} lugares agregado`);
  };

  const startLibraryDrag = (event: React.DragEvent<HTMLButtonElement>, kind: string) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-vase-floor-object', kind);
    event.dataTransfer.setData('text/plain', kind);
  };

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverCanvas(false);
    if (editorMode !== 'edit') return;
    const kind = event.dataTransfer.getData('application/x-vase-floor-object');
    const canvas = canvasRef.current;
    if (!kind || !canvas) return;
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    const viewportPoint = new Point(event.clientX - rect.left, event.clientY - rect.top);
    const transform = canvas.viewportTransform;
    const scenePoint = transform ? viewportPoint.transform(util.invertTransform(transform)) : viewportPoint;
    if (kind === 'table-round' || kind === 'table-rectangular') {
      pendingDropPointRef.current = scenePoint;
      setTableDraft(kind === 'table-round' ? 'round' : 'rectangular');
    } else if (kind === 'chair') addObject('chair', scenePoint);
    else if (kind === 'sofa') addObject('sofa', scenePoint);
    else if (kind === 'wall') addObject('wall', scenePoint);
  };

  const addImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const canvas = canvasRef.current;
    if (!file || !canvas) return;
    const url = URL.createObjectURL(file);
    const image = await FabricImage.fromURL(url);
    image.set({ left: canvas.getCenterPoint().x - 120, top: canvas.getCenterPoint().y - 90 });
    image.scaleToWidth(Math.min(240, image.width ?? 240));
    setObjectData(image, { kind: 'image', fileName: file.name, source: 'local' });
    styleObject(image);
    canvas.add(image);
    canvas.setActiveObject(image);
    canvas.requestRenderAll();
    setStatus('Cambios sin guardar');
    URL.revokeObjectURL(url);
    event.target.value = '';
  };

  const addTable = () => {
    const number = Number(tableNumber);
    const alreadyExists = mesas.some((mesa) => mesa.numero === number) || Boolean(canvasRef.current?.getObjects().some((object) => Number(getData(object).mesaNumero) === number));
    if (!number || !tableDraft || alreadyExists) return;
    onCreateMesa(number);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const center = pendingDropPointRef.current ?? canvas.getVpCenter();
    const table = tableDraft === 'round'
      ? new Circle({ left: 0, top: 0, originX: 'center', originY: 'center', radius: 46, fill: '#211b17', stroke: '#7ed957', strokeWidth: 2.5 })
      : new Rect({ left: 0, top: 0, originX: 'center', originY: 'center', width: 124, height: 78, rx: 18, ry: 18, fill: '#211b17', stroke: '#7ed957', strokeWidth: 2.5 });
    setObjectData(table, { kind: 'table', mesaNumero: number, capacidad: 0, shape: tableDraft });
    styleObject(table);
    const inset = tableDraft === 'round'
      ? new Circle({ left: 0, top: 0, originX: 'center', originY: 'center', radius: 38, fill: '#30251e', stroke: '#564337', strokeWidth: 1 })
      : new Rect({ left: 0, top: 0, originX: 'center', originY: 'center', width: 108, height: 62, rx: 13, ry: 13, fill: '#30251e', stroke: '#564337', strokeWidth: 1 });
    const label = new Textbox(String(number), { left: 0, top: 0, originX: 'center', originY: 'center', width: 44, fontSize: 26, fontWeight: '700', fill: '#fff', textAlign: 'center', selectable: false, evented: false });
    const group = new Group([table, inset, label], { left: center.x, top: center.y, originX: 'center', originY: 'center', subTargetCheck: false, interactive: false, objectCaching: false });
    setObjectData(group, { kind: 'tableGroup', mesaNumero: number, capacidad: 0, shape: tableDraft });
    styleObject(group);
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
    setTableNumber('');
    setTableDraft(null);
    pendingDropPointRef.current = null;
    setStatus('Cambios sin guardar');
  };

  const removeCanvasObject = (target: FabricObject) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = getData(target);
    if (data.kind === 'tableGroup') {
      const backendTable = mesas.find((mesa) => mesa.id === String(data.mesaId) || mesa.numero === Number(data.mesaNumero));
      if (backendTable) {
        onDelete(backendTable.id);
        setStatus('Confirmá la eliminación de la mesa');
        return;
      }
    }
    canvas.remove(target);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setSelected(null);
    setStatus('Cambios sin guardar');
    const serialized = (canvas.toJSON as unknown as (properties?: string[]) => unknown)(['data']);
    window.localStorage.setItem(`${STORAGE_KEY}:section:${activeSection}`, JSON.stringify(serialized));
  };

  const deleteSelected = () => {
    if (selected) removeCanvasObject(selected);
  };

  const syncCapacityForTable = (tableId: unknown) => {
    const canvas = canvasRef.current;
    if (!canvas || tableId == null) return 0;
    const table = canvas.getObjects().find((candidate) => {
      const data = getData(candidate);
      return data.kind === 'tableGroup' && (data.mesaId ?? data.mesaNumero) === tableId;
    });
    const chairCapacity = canvas.getObjects().filter((candidate) => getData(candidate).kind === 'chair' && getData(candidate).tableId === tableId).length;
    const sofaCapacity = canvas.getObjects().filter((candidate) => getData(candidate).kind === 'sofa').reduce((total, sofa) => {
      const allocations = (getData(sofa).allocations as Record<string, number> | undefined) ?? {};
      return total + Number(allocations[String(tableId)] ?? 0);
    }, 0);
    const capacity = chairCapacity + sofaCapacity;
    if (table) {
      const data = getData(table);
      setObjectData(table, { ...data, capacidad: capacity });
      const backendTable = mesas.find((mesa) => mesa.id === String(data.mesaId) || mesa.numero === Number(data.mesaNumero));
      if (backendTable) onUpdateMesaCapacity(backendTable.id, capacity);
    }
    return capacity;
  };

  const confirmPendingLink = () => {
    const canvas = canvasRef.current;
    if (!canvas || !pendingLink) return;
    const previousTableId = getData(pendingLink.chair).tableId;
    const tableData = getData(pendingLink.table);
    const tableId = tableData.mesaId ?? tableData.mesaNumero;
    setObjectData(pendingLink.chair, { ...getData(pendingLink.chair), tableId });
    if (previousTableId != null && previousTableId !== tableId) syncCapacityForTable(previousTableId);
    const capacity = syncCapacityForTable(tableId);
    pendingLink.chair.setCoords();
    canvas.setActiveObject(pendingLink.chair);
    canvas.requestRenderAll();
    setPendingLink(null);
    pushHistorySnapshot();
    setStatus(`Silla unida a la mesa ${tableData.mesaNumero} · ${capacity} ${capacity === 1 ? 'silla' : 'sillas'}`);
  };

  const copySelection = () => {
    const objects = canvasRef.current?.getActiveObjects() ?? [];
    if (!objects.length) return;
    clipboardRef.current = [...objects];
    setStatus(`${objects.length} ${objects.length === 1 ? 'objeto copiado' : 'objetos copiados'}`);
  };

  const pasteClipboard = async () => {
    const canvas = canvasRef.current;
    const originals = clipboardRef.current;
    if (!canvas || !originals.length) return;
    const usedNumbers = new Set([...mesas.map((mesa) => mesa.numero), ...canvas.getObjects().map((object) => Number(getData(object).mesaNumero)).filter(Boolean)]);
    let nextNumber = Math.max(0, ...usedNumbers) + 1;
    const tableIdMap = new Map<unknown, number>();
    originals.filter((object) => getData(object).kind === 'tableGroup').forEach((object) => {
      while (usedNumbers.has(nextNumber)) nextNumber += 1;
      const data = getData(object);
      tableIdMap.set(data.mesaId ?? data.mesaNumero, nextNumber);
      usedNumbers.add(nextNumber);
      nextNumber += 1;
    });
    const clones: FabricObject[] = [];
    for (const original of originals) {
      const clone = await original.clone(['data']);
      const originalData = getData(original);
      const data = { ...originalData };
      if (data.kind === 'tableGroup') {
        const copiedNumber = tableIdMap.get(data.mesaId ?? data.mesaNumero)!;
        setObjectData(clone, { ...data, mesaId: undefined, mesaNumero: copiedNumber, capacidad: 0 });
        if (clone instanceof Group) clone.getObjects().filter((child) => child instanceof Textbox).forEach((label) => label.set({ text: String(copiedNumber) }));
        onCreateMesa(copiedNumber);
      } else if (data.kind === 'chair') {
        setObjectData(clone, { ...data, tableId: tableIdMap.get(data.tableId) ?? null });
      } else if (data.kind === 'sofa') {
        const sourceAllocations = (data.allocations as Record<string, number> | undefined) ?? {};
        const allocations: Record<string, number> = {};
        Object.entries(sourceAllocations).forEach(([tableId, value]) => {
          const copiedTableId = tableIdMap.get(tableId) ?? tableIdMap.get(Number(tableId));
          if (copiedTableId !== undefined) allocations[String(copiedTableId)] = value;
        });
        setObjectData(clone, { ...data, allocations });
      } else setObjectData(clone, data);
      clone.set({ left: (original.left ?? 0) + 28, top: (original.top ?? 0) + 28 });
      clone.setCoords();
      styleObject(clone);
      canvas.add(clone);
      clones.push(clone);
    }
    canvas.discardActiveObject();
    if (clones.length === 1) canvas.setActiveObject(clones[0]);
    else canvas.setActiveObject(new ActiveSelection(clones, { canvas }));
    clipboardRef.current = clones;
    canvas.requestRenderAll();
    setSelectedObjects(clones);
    setSelected(clones[0] ?? null);
    setStatus(`${clones.length} ${clones.length === 1 ? 'objeto pegado' : 'objetos pegados'}`);
    pushHistorySnapshot();
  };

  const linkSelectedObjects = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const objects = canvas.getActiveObjects();
    const table = objects.find((object) => getData(object).kind === 'tableGroup');
    const chairs = objects.filter((object) => getData(object).kind === 'chair');
    if (!table || !chairs.length) return;
    const tableData = getData(table);
    const tableId = tableData.mesaId ?? tableData.mesaNumero;
    const previousIds = new Set(chairs.map((chair) => getData(chair).tableId).filter((id) => id != null && id !== tableId));
    chairs.forEach((chair) => setObjectData(chair, { ...getData(chair), tableId }));
    previousIds.forEach((id) => syncCapacityForTable(id));
    const capacity = syncCapacityForTable(tableId);
    pushHistorySnapshot();
    setStatus(`${chairs.length} ${chairs.length === 1 ? 'silla unida' : 'sillas unidas'} a la mesa ${tableData.mesaNumero} · ${capacity} total`);
    canvas.requestRenderAll();
  };

  const openSofaAllocation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const objects = canvas.getActiveObjects();
    const sofa = objects.find((object) => getData(object).kind === 'sofa');
    const tables = objects.filter((object) => getData(object).kind === 'tableGroup');
    if (!sofa || !tables.length) return;
    const existing = (getData(sofa).allocations as Record<string, number> | undefined) ?? {};
    const allocations: Record<string, string> = {};
    tables.forEach((table) => {
      const data = getData(table);
      const key = String(data.mesaId ?? data.mesaNumero);
      allocations[key] = String(existing[key] ?? 1);
    });
    setSofaAllocationDraft({ sofa, tables, allocations });
  };

  const confirmSofaAllocation = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sofaAllocationDraft) return;
    const sofaData = getData(sofaAllocationDraft.sofa);
    const totalCapacity = Number(sofaData.capacity ?? 1);
    const allocations = { ...((sofaData.allocations as Record<string, number> | undefined) ?? {}) };
    const selectedKeys = new Set(Object.keys(sofaAllocationDraft.allocations));
    const otherAssigned = Object.entries(allocations).filter(([key]) => !selectedKeys.has(key)).reduce((sum, [, value]) => sum + Number(value || 0), 0);
    const selectedAssigned = Object.values(sofaAllocationDraft.allocations).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    const assigned = otherAssigned + selectedAssigned;
    if (assigned > totalCapacity) return;
    const affectedIds = new Set<string>();
    sofaAllocationDraft.tables.forEach((table) => {
      const data = getData(table);
      const key = String(data.mesaId ?? data.mesaNumero);
      const value = Math.max(0, Number(sofaAllocationDraft.allocations[key]) || 0);
      affectedIds.add(key);
      if (value > 0) allocations[key] = value;
      else delete allocations[key];
    });
    setObjectData(sofaAllocationDraft.sofa, { ...sofaData, allocations });
    affectedIds.forEach((id) => syncCapacityForTable(id));
    pushHistorySnapshot();
    setSofaAllocationDraft(null);
    setStatus(`Sillón distribuido: ${assigned} de ${totalCapacity} lugares`);
    canvas.requestRenderAll();
  };

  const unlinkSelectedObjects = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const chairs = canvas.getActiveObjects().filter((object) => getData(object).kind === 'chair' && getData(object).tableId != null);
    const previousIds = new Set(chairs.map((chair) => getData(chair).tableId));
    chairs.forEach((chair) => setObjectData(chair, { ...getData(chair), tableId: null }));
    previousIds.forEach((id) => syncCapacityForTable(id));
    const sofa = canvas.getActiveObjects().find((object) => getData(object).kind === 'sofa');
    if (sofa) {
      const sofaData = getData(sofa);
      const allocations = { ...((sofaData.allocations as Record<string, number> | undefined) ?? {}) };
      const selectedTableIds = canvas.getActiveObjects().filter((object) => getData(object).kind === 'tableGroup').map((table) => String(getData(table).mesaId ?? getData(table).mesaNumero));
      const idsToRemove = selectedTableIds.length ? selectedTableIds : Object.keys(allocations);
      idsToRemove.forEach((id) => delete allocations[id]);
      setObjectData(sofa, { ...sofaData, allocations });
      idsToRemove.forEach((id) => syncCapacityForTable(id));
    }
    pushHistorySnapshot();
    setStatus(`${chairs.length} ${chairs.length === 1 ? 'silla desunida' : 'sillas desunidas'}`);
    canvas.requestRenderAll();
  };

  const unlinkChair = (chair: FabricObject) => {
    const canvas = canvasRef.current;
    if (!canvas || getData(chair).kind !== 'chair') return;
    const tableId = getData(chair).tableId;
    setObjectData(chair, { ...getData(chair), tableId: null });
    const table = canvas.getObjects().find((candidate) => {
      const data = getData(candidate);
      return data.kind === 'tableGroup' && (data.mesaId ?? data.mesaNumero) === tableId;
    });
    if (table) {
      syncCapacityForTable(tableId);
    }
    setContextMenu(null);
    setStatus('Silla desunida · cambios sin guardar');
    canvas.requestRenderAll();
  };

  const manageSofaLinks = (sofa: FabricObject) => {
    const canvas = canvasRef.current;
    if (!canvas || getData(sofa).kind !== 'sofa') return;
    const existing = (getData(sofa).allocations as Record<string, number> | undefined) ?? {};
    const linkedIds = new Set(Object.keys(existing));
    const tables = canvas.getObjects().filter((object) => {
      const data = getData(object);
      return data.kind === 'tableGroup' && linkedIds.has(String(data.mesaId ?? data.mesaNumero));
    });
    const allocations = Object.fromEntries(tables.map((table) => {
      const key = String(getData(table).mesaId ?? getData(table).mesaNumero);
      return [key, String(existing[key] ?? 0)];
    }));
    setContextMenu(null);
    if (tables.length) setSofaAllocationDraft({ sofa, tables, allocations });
  };

  const unlinkSofa = (sofa: FabricObject) => {
    const canvas = canvasRef.current;
    if (!canvas || getData(sofa).kind !== 'sofa') return;
    const sofaData = getData(sofa);
    const allocations = (sofaData.allocations as Record<string, number> | undefined) ?? {};
    const affectedIds = Object.keys(allocations);
    setObjectData(sofa, { ...sofaData, allocations: {} });
    affectedIds.forEach((id) => syncCapacityForTable(id));
    pushHistorySnapshot();
    setContextMenu(null);
    setStatus(`Sillón desunido de ${affectedIds.length} ${affectedIds.length === 1 ? 'mesa' : 'mesas'}`);
    canvas.setActiveObject(sofa);
    canvas.requestRenderAll();
  };

  const removeContextTarget = () => {
    const target = contextMenu?.target;
    if (!target) return;
    removeCanvasObject(target);
    setContextMenu(null);
  };

  useEffect(() => {
    const handleEditorShortcut = (event: KeyboardEvent) => {
      if (editorMode !== 'edit') return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select') || target?.isContentEditable) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        const direction = event.shiftKey ? 1 : -1;
        const index = historyIndexRef.current + direction;
        const snapshot = historyRef.current[index];
        const canvas = canvasRef.current;
        if (canvas && snapshot) void canvas.loadFromJSON(JSON.parse(snapshot)).then(() => { historyIndexRef.current = index; canvas.discardActiveObject(); canvas.requestRenderAll(); setStatus(direction < 0 ? 'Cambio deshecho' : 'Cambio rehecho'); });
        return;
      }
      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        const index = historyIndexRef.current + 1;
        const snapshot = historyRef.current[index];
        const canvas = canvasRef.current;
        if (canvas && snapshot) void canvas.loadFromJSON(JSON.parse(snapshot)).then(() => { historyIndexRef.current = index; canvas.discardActiveObject(); canvas.requestRenderAll(); setStatus('Cambio rehecho'); });
        return;
      }
      if (modifier && event.key.toLowerCase() === 'c') { event.preventDefault(); copySelection(); return; }
      if (modifier && event.key.toLowerCase() === 'v') { event.preventDefault(); void pasteClipboard(); return; }
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      const activeObject = canvasRef.current?.getActiveObject() ?? selected;
      if (!activeObject) return;
      event.preventDefault();
      removeCanvasObject(activeObject);
    };
    window.addEventListener('keydown', handleEditorShortcut);
    return () => window.removeEventListener('keydown', handleEditorShortcut);
  }, [activeSection, editorMode, mesas, onDelete, selected]);

  const zoomBy = (factor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const next = Math.max(0.35, Math.min(2.5, canvas.getZoom() * factor));
    canvas.zoomToPoint(canvas.getCenterPoint(), next);
    setZoom(next);
  };

  const restoreHistory = async (index: number) => {
    const canvas = canvasRef.current;
    const snapshot = historyRef.current[index];
    if (!canvas || !snapshot || index < 0 || index >= historyRef.current.length) return;
    historyIndexRef.current = index;
    await canvas.loadFromJSON(JSON.parse(snapshot));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setStatus('Cambios sin guardar');
  };

  const duplicateTableNumber = Number(tableNumber) > 0 && (mesas.some((mesa) => mesa.numero === Number(tableNumber)) || Boolean(canvasRef.current?.getObjects().some((object) => Number(getData(object).mesaNumero) === Number(tableNumber))));
  const selectedTables = selectedObjects.filter((object) => getData(object).kind === 'tableGroup');
  const selectedChairs = selectedObjects.filter((object) => getData(object).kind === 'chair');
  const selectedSofas = selectedObjects.filter((object) => getData(object).kind === 'sofa');
  const canLinkSelection = selectedTables.length === 1 && selectedChairs.length > 0;
  const canAllocateSofa = selectedSofas.length === 1 && selectedTables.length > 0;
  const canUnlinkSelection = selectedChairs.some((chair) => getData(chair).tableId != null) || selectedSofas.some((sofa) => Object.keys((getData(sofa).allocations as Record<string, number> | undefined) ?? {}).length > 0);
  const sofaDraftSelectedAssigned = sofaAllocationDraft ? Object.values(sofaAllocationDraft.allocations).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0) : 0;
  const sofaDraftOtherAssigned = sofaAllocationDraft ? Object.entries((getData(sofaAllocationDraft.sofa).allocations as Record<string, number> | undefined) ?? {}).filter(([key]) => !(key in sofaAllocationDraft.allocations)).reduce((sum, [, value]) => sum + Number(value || 0), 0) : 0;
  const sofaDraftAssigned = sofaDraftSelectedAssigned + sofaDraftOtherAssigned;
  const sofaDraftCapacity = sofaAllocationDraft ? Number(getData(sofaAllocationDraft.sofa).capacity ?? 1) : 0;

  return <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#0b0f0c]" ref={wrapperRef} onDragEnter={(event) => { if (event.dataTransfer.types.includes('application/x-vase-floor-object')) setDragOverCanvas(true); }} onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-vase-floor-object')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverCanvas(false); }} onDrop={handleCanvasDrop}>
    <canvas ref={canvasElement} className={tool === 'hand' ? 'cursor-grab' : 'cursor-default'} />
    {dragOverCanvas && <div className="pointer-events-none absolute inset-3 z-10 flex items-end justify-center rounded-3xl border-2 border-dashed border-[#7ed957]/70 bg-[#7ed957]/5 pb-8"><span className="rounded-full border border-[#7ed957]/30 bg-[#132016]/95 px-4 py-2 text-sm font-medium text-[#c8f7ae] shadow-xl">Soltá para agregar al plano</span></div>}
    <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-[#2b3a2f] bg-[#151a16]/95 p-1.5 shadow-2xl backdrop-blur-xl">
      <div className="flex rounded-xl bg-[#0d110e] p-1"><button onClick={() => setEditorMode('edit')} className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${editorMode === 'edit' ? 'bg-[#7ed957] text-[#0e0e0e]' : 'text-[#829487] hover:text-white'}`}><Pencil size={16} /><span className="hidden xl:inline">Editar</span></button><button onClick={() => setEditorMode('preview')} className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${editorMode === 'preview' ? 'bg-[#7ed957] text-[#0e0e0e]' : 'text-[#829487] hover:text-white'}`}><Eye size={16} /><span className="hidden xl:inline">Previsualizar</span></button></div>
      <div className="mx-1 h-7 w-px bg-[#2b3a2f]" />
      <button onClick={() => setTool('select')} className={`rounded-xl p-2.5 ${tool === 'select' ? 'bg-[#7ed957] text-[#0e0e0e]' : 'text-[#829487]'}`} title="Seleccionar"><MousePointer2 size={17} /></button>
      <button onClick={() => setTool('hand')} className={`rounded-xl p-2.5 ${tool === 'hand' ? 'bg-[#7ed957] text-[#0e0e0e]' : 'text-[#829487]'}`} title="Mover viewport"><Hand size={17} /></button>
      <div className="mx-1 h-7 w-px bg-[#2b3a2f]" />
      <button onClick={() => restoreHistory(historyIndexRef.current - 1)} disabled={historyIndexRef.current <= 0} className="rounded-xl p-2.5 text-[#829487] disabled:opacity-30" title="Deshacer"><Undo2 size={17} /></button><button onClick={() => restoreHistory(historyIndexRef.current + 1)} disabled={historyIndexRef.current >= historyRef.current.length - 1} className="rounded-xl p-2.5 text-[#829487] disabled:opacity-30" title="Rehacer"><Redo2 size={17} /></button>
      <button onClick={copySelection} disabled={!selectedObjects.length} className="rounded-xl p-2.5 text-[#829487] transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30" title="Copiar (Ctrl+C)"><Copy size={17} /></button><button onClick={() => void pasteClipboard()} disabled={!clipboardRef.current.length} className="rounded-xl p-2.5 text-[#829487] transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30" title="Pegar (Ctrl+V)"><ClipboardPaste size={17} /></button>
      <div className="mx-1 h-7 w-px bg-[#2b3a2f]" />
      <button onClick={() => { setLibraryOpen((open) => !open); setSectionsOpen(false); }} className={`flex h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors ${libraryOpen ? 'bg-[#243523] text-[#b7f397]' : 'text-[#829487] hover:bg-white/5 hover:text-white'}`} title="Biblioteca"><Shapes size={18} /><span className="hidden 2xl:inline">Biblioteca</span></button>
      <button onClick={() => { setSectionsOpen((open) => !open); setLibraryOpen(false); }} className={`flex h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors ${sectionsOpen ? 'bg-[#243523] text-[#b7f397]' : 'text-[#829487] hover:bg-white/5 hover:text-white'}`} title="Secciones"><Layers3 size={18} /><span className="hidden 2xl:inline">Secciones</span></button>
      <button onClick={deleteSelected} disabled={!selected} className="rounded-xl p-2.5 text-red-300 disabled:opacity-30" title="Eliminar"><Trash2 size={17} /></button><button onClick={save} className="rounded-xl bg-[#7ed957] p-2.5 text-[#0e0e0e]" title="Guardar"><Save size={17} /></button>
    </div>
    {(canLinkSelection || canAllocateSofa || canUnlinkSelection) && editorMode === 'edit' && <div className="absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-[#304034] bg-[#151a16]/95 p-2 shadow-2xl backdrop-blur-xl">{canLinkSelection && <button onClick={linkSelectedObjects} className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-[#7ed957] px-4 text-sm font-semibold text-[#0e0e0e] transition-colors hover:bg-[#8be568]"><Link2 size={17} />Unir {selectedChairs.length} {selectedChairs.length === 1 ? 'silla' : 'sillas'}</button>}{canAllocateSofa && <button onClick={openSofaAllocation} className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-[#7ed957] px-4 text-sm font-semibold text-[#0e0e0e] transition-colors hover:bg-[#8be568]"><Link2 size={17} />Distribuir sillón</button>}{canUnlinkSelection && <button onClick={unlinkSelectedObjects} className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#3a4a3e] px-4 text-sm font-medium text-[#c4d0c7] transition-colors hover:bg-white/5"><Unlink size={17} />Desunir</button>}</div>}
    <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1 rounded-2xl border border-[#2b3a2f] bg-[#151a16]/95 p-1.5 shadow-xl backdrop-blur-xl"><button onClick={() => zoomBy(0.9)} className="h-9 w-9 rounded-xl text-[#829487] hover:bg-white/10"><ZoomOut size={16} /></button><span className="min-w-12 text-center text-xs text-[#829487]">{Math.round(zoom * 100)}%</span><button onClick={() => zoomBy(1.1)} className="h-9 w-9 rounded-xl text-[#829487] hover:bg-white/10"><ZoomIn size={16} /></button></div>
    {sectionsOpen && <aside className="absolute right-0 top-0 z-20 h-full w-80 overflow-y-auto border-l border-[#26362a] bg-[#111612]/98 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between"><div><p className="text-base font-semibold text-white">Secciones</p><p className="mt-1 text-sm text-[#829487]">Cada sección tiene su propio plano</p></div><button aria-label="Cerrar secciones" onClick={() => setSectionsOpen(false)} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#829487] hover:bg-white/5 hover:text-white"><X size={19} /></button></div>
      <div className="mt-6 space-y-2">{sections.map((section) => <button key={section} onClick={() => switchSection(section)} className={`flex min-h-12 w-full cursor-pointer items-center justify-between rounded-xl border px-4 text-left text-sm transition-colors ${section === activeSection ? 'border-[#7ed957]/50 bg-[#243523] text-[#c8f7ae]' : 'border-[#26362a] bg-[#182019] text-[#a0ada4] hover:border-[#435848] hover:text-white'}`}><span>{section}</span>{section === activeSection && <span className="h-2 w-2 rounded-full bg-[#7ed957]" />}</button>)}</div>
      <div className="mt-6 border-t border-[#26362a] pt-5"><label htmlFor="new-section-name" className="text-xs font-medium uppercase tracking-wider text-[#829487]">Nueva sección</label><div className="mt-2 flex gap-2"><input id="new-section-name" value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') createSection(); }} placeholder="Ej. Terraza" className="h-11 min-w-0 flex-1 rounded-xl border border-[#304034] bg-[#0f1310] px-3 text-sm text-white outline-none placeholder:text-[#526057] focus:border-[#7ed957]" /><button aria-label="Crear sección" onClick={createSection} disabled={!newSectionName.trim()} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-[#7ed957] text-[#0e0e0e] disabled:cursor-not-allowed disabled:opacity-40"><Plus size={18} /></button></div></div>
    </aside>}
    {libraryOpen && <aside className="absolute right-0 top-0 z-20 h-full w-80 overflow-y-auto border-l border-[#26362a] bg-[#111612]/98 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between"><div><p className="text-base font-semibold text-white">Biblioteca</p><p className="mt-1 text-sm text-[#829487]">Agregá elementos al plano</p></div><button aria-label="Cerrar biblioteca" onClick={() => setLibraryOpen(false)} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#829487] transition-colors hover:bg-white/5 hover:text-white"><X size={19} /></button></div>
      <p className="mb-3 mt-7 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#647568]">Mesas</p>
      <div className="grid grid-cols-2 gap-3">
        <button draggable onDragStart={(event) => startLibraryDrag(event, 'table-round')} onClick={() => { pendingDropPointRef.current = null; setTableDraft('round'); }} className="flex min-h-28 cursor-grab flex-col items-center justify-center gap-3 rounded-2xl border border-[#26362a] bg-[#182019] text-[#b7f397] transition-colors hover:border-[#7ed957] hover:bg-[#1d281f] active:cursor-grabbing"><span className="h-10 w-10 rounded-full border-2 border-current" /><span className="text-sm">Redonda</span><span className="text-[10px] uppercase tracking-wider text-[#708375]">Arrastrar</span></button>
        <button draggable onDragStart={(event) => startLibraryDrag(event, 'table-rectangular')} onClick={() => { pendingDropPointRef.current = null; setTableDraft('rectangular'); }} className="flex min-h-28 cursor-grab flex-col items-center justify-center gap-3 rounded-2xl border border-[#26362a] bg-[#182019] text-[#b7f397] transition-colors hover:border-[#7ed957] hover:bg-[#1d281f] active:cursor-grabbing"><span className="h-8 w-12 rounded-lg border-2 border-current" /><span className="text-sm">Rectangular</span><span className="text-[10px] uppercase tracking-wider text-[#708375]">Arrastrar</span></button>
      </div>
      <p className="mb-3 mt-7 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#647568]">Mobiliario</p>
      <div className="grid grid-cols-2 gap-3">
        <button draggable onDragStart={(event) => startLibraryDrag(event, 'chair')} onClick={() => addObject('chair')} className="flex min-h-24 cursor-grab flex-col items-center justify-center gap-2 rounded-2xl border border-[#26362a] bg-[#182019] text-[#b7f397] transition-colors hover:border-[#7ed957] hover:bg-[#1d281f] active:cursor-grabbing"><span className="relative block h-9 w-9"><span className="absolute left-0.5 top-0 h-2.5 w-8 rounded-md border border-[#b7c8bc] bg-[#6f8978]" /><span className="absolute left-1.5 top-2.5 h-6 w-6 rounded-md border border-[#a9beaf] bg-[#33483a]" /></span><span className="text-sm">Silla</span><span className="text-[10px] text-[#708375]">Arrastrar</span></button>
        <button draggable onDragStart={(event) => startLibraryDrag(event, 'sofa')} onClick={() => addObject('sofa')} className="flex min-h-24 cursor-grab flex-col items-center justify-center gap-2 rounded-2xl border border-[#26362a] bg-[#182019] text-[#b7f397] transition-colors hover:border-[#7ed957] hover:bg-[#1d281f] active:cursor-grabbing"><span className="relative block h-9 w-14"><span className="absolute left-1 top-0 h-3 w-12 rounded-lg border border-[#b7c8bc] bg-[#46614f]" /><span className="absolute left-1 top-2 h-7 w-12 rounded-lg border border-[#a9beaf] bg-[#304438]" /><span className="absolute left-0 top-3 h-6 w-2 rounded bg-[#3a5142]" /><span className="absolute right-0 top-3 h-6 w-2 rounded bg-[#3a5142]" /></span><span className="text-sm">Sillón</span><span className="text-[10px] text-[#708375]">Arrastrar</span></button>
        <button draggable onDragStart={(event) => startLibraryDrag(event, 'wall')} onClick={() => addObject('wall')} className="flex min-h-24 cursor-grab flex-col items-center justify-center gap-2 rounded-2xl border border-[#26362a] bg-[#182019] text-[#b7f397] transition-colors hover:border-[#7ed957] hover:bg-[#1d281f] active:cursor-grabbing"><Square size={25} /><span className="text-sm">Pared</span><span className="text-[10px] text-[#708375]">Arrastrar</span></button>
        <button onClick={() => fileInput.current?.click()} className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-[#26362a] bg-[#182019] text-[#b7f397] transition-colors hover:border-[#7ed957] hover:bg-[#1d281f]"><ImagePlus size={25} /><span className="text-sm">Imagen</span></button>
      </div>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={addImage} className="hidden" />
      <p className="mt-6 rounded-2xl border border-[#26362a] bg-[#151c16] p-4 text-xs leading-5 text-[#829487]">Elegí una mesa y asignale solamente su número. Las sillas se agregan después desde esta biblioteca.</p>
    </aside>}
    {sofaCapacityDraft !== null && <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="sofa-capacity-title" className="w-full max-w-sm rounded-3xl border border-[#2b3a2f] bg-[#151a16] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="sofa-capacity-title" className="text-xl font-semibold text-white">Nuevo sillón</h2><p className="mt-2 text-sm leading-6 text-[#829487]">Indicá cuántas personas pueden usarlo en total.</p></div><button aria-label="Cerrar" onClick={() => setSofaCapacityDraft(null)} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#829487] hover:bg-white/5 hover:text-white"><X size={19} /></button></div><label htmlFor="sofa-capacity" className="mt-6 block text-xs font-medium uppercase tracking-wider text-[#829487]">Capacidad total</label><input id="sofa-capacity" autoFocus type="number" min="1" value={sofaCapacityDraft} onChange={(event) => setSofaCapacityDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') createSofa(); }} className="mt-2 h-12 w-full rounded-xl border border-[#304034] bg-[#0f1310] px-4 text-white outline-none focus:border-[#7ed957] focus:ring-2 focus:ring-[#7ed957]/20" /><div className="mt-6 flex gap-3"><button onClick={() => setSofaCapacityDraft(null)} className="h-12 flex-1 rounded-xl border border-[#304034] text-sm text-[#a0ada4] hover:bg-white/5">Cancelar</button><button onClick={createSofa} disabled={Number(sofaCapacityDraft) < 1} className="h-12 flex-1 rounded-xl bg-[#7ed957] text-sm font-semibold text-[#0e0e0e] disabled:opacity-40">Crear sillón</button></div></div></div>}
    {sofaAllocationDraft && <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="sofa-allocation-title" className="w-full max-w-md rounded-3xl border border-[#2b3a2f] bg-[#151a16] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="sofa-allocation-title" className="text-xl font-semibold text-white">Distribuir capacidad del sillón</h2><p className="mt-2 text-sm text-[#829487]">Asigná cuántos lugares utiliza cada mesa seleccionada.</p></div><button aria-label="Cerrar" onClick={() => setSofaAllocationDraft(null)} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#829487] hover:bg-white/5 hover:text-white"><X size={19} /></button></div><div className="mt-5 space-y-3">{sofaAllocationDraft.tables.map((table) => { const data = getData(table); const key = String(data.mesaId ?? data.mesaNumero); return <label key={key} className="flex items-center justify-between rounded-2xl border border-[#2b3a2f] bg-[#101511] p-3"><span className="text-sm font-medium text-white">Mesa N.º {String(data.mesaNumero)}</span><input type="number" min="0" max={sofaDraftCapacity} value={sofaAllocationDraft.allocations[key] ?? '0'} onChange={(event) => setSofaAllocationDraft((current) => current ? { ...current, allocations: { ...current.allocations, [key]: event.target.value } } : null)} className="h-10 w-20 rounded-xl border border-[#304034] bg-[#0b0f0c] px-3 text-center text-white outline-none focus:border-[#7ed957]" /></label>; })}</div><div className={`mt-4 rounded-xl border p-3 text-sm ${sofaDraftAssigned > sofaDraftCapacity ? 'border-red-400/40 bg-red-400/10 text-red-300' : 'border-[#304034] bg-[#101511] text-[#aebbb1]'}`}>{sofaDraftAssigned} de {sofaDraftCapacity} lugares asignados{sofaDraftAssigned > sofaDraftCapacity ? ' · Supera la capacidad total' : ''}</div><div className="mt-6 flex gap-3"><button onClick={() => setSofaAllocationDraft(null)} className="h-12 flex-1 rounded-xl border border-[#304034] text-sm text-[#a0ada4] hover:bg-white/5">Cancelar</button><button onClick={confirmSofaAllocation} disabled={sofaDraftAssigned > sofaDraftCapacity} className="h-12 flex-1 rounded-xl bg-[#7ed957] text-sm font-semibold text-[#0e0e0e] disabled:opacity-40">Guardar distribución</button></div></div></div>}
    {tableDraft && <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setTableDraft(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="create-table-title" className="w-full max-w-sm rounded-3xl border border-[#2b3a2f] bg-[#151a16] p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><h2 id="create-table-title" className="text-lg font-semibold text-white">Nueva mesa {tableDraft === 'round' ? 'redonda' : 'rectangular'}</h2><p className="mt-1 text-sm text-[#829487]">Ingresá el número que la identifica.</p></div><button aria-label="Cerrar" onClick={() => setTableDraft(null)} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#829487] hover:bg-white/5 hover:text-white"><X size={19} /></button></div>
        <label htmlFor="fabric-table-number" className="mt-6 block text-xs font-medium uppercase tracking-wider text-[#829487]">Número de mesa</label>
        <input id="fabric-table-number" autoFocus value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !duplicateTableNumber) addTable(); if (event.key === 'Escape') setTableDraft(null); }} type="number" min="1" aria-invalid={duplicateTableNumber} aria-describedby={duplicateTableNumber ? 'duplicate-table-error' : undefined} placeholder="Ej. 12" className={`mt-2 h-12 w-full rounded-xl border bg-[#0f1310] px-4 text-base text-white outline-none transition-colors placeholder:text-[#526057] focus:ring-2 ${duplicateTableNumber ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : 'border-[#304034] focus:border-[#7ed957] focus:ring-[#7ed957]/20'}`} />
        {duplicateTableNumber && <p id="duplicate-table-error" className="mt-2 text-sm text-red-300">Ya existe una mesa con ese número.</p>}
        <div className="mt-6 flex gap-3"><button onClick={() => setTableDraft(null)} className="h-12 flex-1 cursor-pointer rounded-xl border border-[#304034] text-sm font-medium text-[#a0ada4] transition-colors hover:bg-white/5">Cancelar</button><button onClick={addTable} disabled={!Number(tableNumber) || duplicateTableNumber} className="h-12 flex-1 cursor-pointer rounded-xl bg-[#7ed957] text-sm font-semibold text-[#0e0e0e] transition-colors hover:bg-[#8be568] disabled:cursor-not-allowed disabled:opacity-40">Crear mesa</button></div>
      </div>
    </div>}
    {pendingLink && <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingLink(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="link-chair-title" className="w-full max-w-sm rounded-3xl border border-[#2b3a2f] bg-[#151a16] p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7ed957]">Relacionar silla</p><h2 id="link-chair-title" className="mt-2 text-xl font-semibold text-white">¿Unir con la mesa N.º {String(getData(pendingLink.table).mesaNumero)}?</h2><p className="mt-2 text-sm leading-6 text-[#829487]">La capacidad de la mesa se actualizará según la cantidad real de sillas relacionadas.</p></div><button aria-label="Cerrar" onClick={() => setPendingLink(null)} className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#829487] hover:bg-white/5 hover:text-white"><X size={19} /></button></div>
        <div className="mt-6 flex gap-3"><button onClick={() => setPendingLink(null)} className="h-12 flex-1 cursor-pointer rounded-xl border border-[#304034] text-sm font-medium text-[#a0ada4] transition-colors hover:bg-white/5">Cancelar</button><button onClick={confirmPendingLink} className="h-12 flex-1 cursor-pointer rounded-xl bg-[#7ed957] text-sm font-semibold text-[#0e0e0e] transition-colors hover:bg-[#8be568]">Unir silla</button></div>
      </div>
    </div>}
    {contextMenu && editorMode === 'edit' && <div className="absolute z-50 min-w-52 overflow-hidden rounded-2xl border border-[#304034] bg-[#151a16]/98 p-1.5 shadow-2xl backdrop-blur-xl" style={{ left: Math.min(contextMenu.x, Math.max(16, (wrapperRef.current?.clientWidth ?? 300) - 230)), top: Math.min(contextMenu.y, Math.max(16, (wrapperRef.current?.clientHeight ?? 300) - 190)) }}>
      {contextMenu.target ? <>{getData(contextMenu.target).kind === 'chair' && getData(contextMenu.target).tableId != null && <button onClick={() => unlinkChair(contextMenu.target!)} className="flex h-11 w-full cursor-pointer items-center rounded-xl px-3 text-left text-sm text-[#d4dfd7] transition-colors hover:bg-white/5">Desunir de la mesa</button>}{getData(contextMenu.target).kind === 'sofa' && Object.keys((getData(contextMenu.target).allocations as Record<string, number> | undefined) ?? {}).length > 0 && <><button onClick={() => manageSofaLinks(contextMenu.target!)} className="flex h-11 w-full cursor-pointer items-center rounded-xl px-3 text-left text-sm text-[#d4dfd7] transition-colors hover:bg-white/5">Administrar mesas vinculadas</button><button onClick={() => unlinkSofa(contextMenu.target!)} className="flex h-11 w-full cursor-pointer items-center rounded-xl px-3 text-left text-sm text-[#d4dfd7] transition-colors hover:bg-white/5">Desunir de todas las mesas</button></>}<button onClick={() => { const canvas = canvasRef.current; if (canvas && contextMenu.target) { canvas.bringObjectToFront(contextMenu.target); canvas.requestRenderAll(); } setContextMenu(null); }} className="flex h-11 w-full cursor-pointer items-center rounded-xl px-3 text-left text-sm text-[#d4dfd7] transition-colors hover:bg-white/5">Traer al frente</button><button onClick={removeContextTarget} className="flex h-11 w-full cursor-pointer items-center rounded-xl px-3 text-left text-sm text-red-300 transition-colors hover:bg-red-400/10">Eliminar</button></> : <p className="px-3 py-2 text-sm text-[#829487]">No hay un objeto seleccionado</p>}
    </div>}
    {previewInfo && editorMode === 'preview' && <div className="absolute z-30 w-56 rounded-2xl border border-[#304034] bg-[#151a16]/98 p-4 shadow-2xl backdrop-blur-xl" style={{ left: Math.min(previewInfo.x + 14, Math.max(16, (wrapperRef.current?.clientWidth ?? 300) - 240)), top: Math.min(previewInfo.y + 14, Math.max(16, (wrapperRef.current?.clientHeight ?? 300) - 150)) }}><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-wider text-[#829487]">Mesa</p><p className="mt-1 text-xl font-semibold text-white">{previewInfo.numero}</p></div><button aria-label="Cerrar información" onClick={() => setPreviewInfo(null)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#829487] hover:bg-white/5 hover:text-white"><X size={17} /></button></div><p className="mt-3 text-sm text-[#aebbb1]">{previewInfo.capacidad} {previewInfo.capacidad === 1 ? 'silla asociada' : 'sillas asociadas'}</p></div>}
    <span className="absolute bottom-5 right-5 z-20 rounded-xl border border-[#2b3a2f] bg-[#151a16]/90 px-3 py-2 text-xs text-[#829487]">{status}</span>
  </div>;
}
