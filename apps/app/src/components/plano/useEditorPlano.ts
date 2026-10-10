import { useCallback, useMemo, useState } from 'react';
import {
  MEDIDA_ELEMENTO,
  ajustar,
  lugarLibre,
  medidaMesa,
  nuevoId,
  COLORES_ZONA,
  type ElementoPlano,
  type FormaMesa,
  type Mesa,
  type MesaEnPlano,
  type Plano,
  type TipoElemento,
  type ZonaPlano,
} from '@vase/domain';
import type { Seleccion } from './PlanoCanvas';

const HISTORIA_MAX = 50;

/** Estado del editor: el plano, el historial para deshacer y los números de mesa (existentes y nuevas). */
export function useEditorPlano(inicial: Plano, mesas: readonly Mesa[]) {
  const [plano, setPlano] = useState<Plano>(inicial);
  const [historia, setHistoria] = useState<Plano[]>([]);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [numeros, setNumeros] = useState<Record<string, number>>(() => Object.fromEntries(mesas.map((m) => [m.id, m.numero])));
  const [sucio, setSucio] = useState(false);

  const aplicar = useCallback((cambio: (p: Plano) => Plano) => {
    setPlano((actual) => {
      const siguiente = cambio(actual);
      if (siguiente === actual) return actual;
      setHistoria((h) => [...h.slice(-HISTORIA_MAX + 1), actual]);
      setSucio(true);
      return siguiente;
    });
  }, []);

  const deshacer = useCallback(() => {
    setHistoria((h) => {
      if (h.length === 0) return h;
      setPlano(h[h.length - 1]);
      setSucio(true);
      return h.slice(0, -1);
    });
  }, []);

  const limitar = (p: Plano, x: number, y: number) => ({ x: Math.min(p.ancho - 20, Math.max(20, x)), y: Math.min(p.alto - 20, Math.max(20, y)) });

  const mover = useCallback((tipo: 'mesa' | 'zona' | 'elemento', id: string, dx: number, dy: number) => {
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    aplicar((p) => {
      if (tipo === 'mesa') return { ...p, mesas: p.mesas.map((m) => (m.mesaId === id ? { ...m, ...limitar(p, ajustar(m.x + dx), ajustar(m.y + dy)) } : m)) };
      if (tipo === 'elemento') return { ...p, elementos: p.elementos.map((e) => (e.id === id ? { ...e, ...limitar(p, ajustar(e.x + dx), ajustar(e.y + dy)) } : e)) };
      return { ...p, zonas: p.zonas.map((z) => (z.id === id ? { ...z, x: ajustar(z.x + dx), y: ajustar(z.y + dy) } : z)) };
    });
  }, [aplicar]);

  const siguienteNumero = useCallback(() => Math.max(0, ...Object.values(numeros)) + 1, [numeros]);

  const agregarMesa = useCallback((forma: FormaMesa, centro: { x: number; y: number }, mesaExistente?: Mesa) => {
    const asientos = mesaExistente?.capacidad || (forma === 'rectangular' ? 6 : 4);
    const medida = medidaMesa(forma, asientos);
    const mesaId = mesaExistente?.id ?? nuevoId('nueva');
    if (!mesaExistente) setNumeros((n) => ({ ...n, [mesaId]: Math.max(0, ...Object.values(n)) + 1 }));
    const silla = 2 * 50;
    aplicar((p) => {
      const nueva: MesaEnPlano = { mesaId, forma, asientos, rot: 0, ...medida, ...lugarLibre(p, medida.ancho + silla, medida.alto + silla, centro) };
      return { ...p, mesas: [...p.mesas, nueva] };
    });
    setSeleccion({ tipo: 'mesa', id: mesaId });
  }, [aplicar]);

  const agregarZona = useCallback((centro: { x: number; y: number }) => {
    const id = nuevoId('zona');
    aplicar((p) => {
      const zona: ZonaPlano = { id, nombre: `Zona ${p.zonas.length + 1}`, color: COLORES_ZONA[p.zonas.length % COLORES_ZONA.length], w: 500, h: 350, x: ajustar(centro.x - 250), y: ajustar(centro.y - 175) };
      return { ...p, zonas: [...p.zonas, zona] };
    });
    setSeleccion({ tipo: 'zona', id });
  }, [aplicar]);

  const agregarElemento = useCallback((tipo: TipoElemento, centro: { x: number; y: number }) => {
    const id = nuevoId('el');
    const medida = MEDIDA_ELEMENTO[tipo];
    aplicar((p) => {
      const barrido = tipo === 'puerta' ? medida.w * 2 : 0;
      const elemento: ElementoPlano = { id, tipo, rot: 0, ...medida, ...lugarLibre(p, barrido || medida.w, barrido || medida.h, centro) };
      return { ...p, elementos: [...p.elementos, elemento] };
    });
    setSeleccion({ tipo: 'elemento', id });
  }, [aplicar]);

  const cambiarMesa = useCallback((id: string, cambios: Partial<MesaEnPlano>) => {
    aplicar((p) => ({
      ...p,
      mesas: p.mesas.map((m) => {
        if (m.mesaId !== id) return m;
        const siguiente = { ...m, ...cambios };
        // Si cambia la forma o los lugares, la mesa toma la medida que corresponde.
        if (cambios.forma !== undefined || cambios.asientos !== undefined) Object.assign(siguiente, medidaMesa(siguiente.forma, siguiente.asientos));
        return siguiente;
      }),
    }));
  }, [aplicar]);

  const cambiarZona = useCallback((id: string, cambios: Partial<ZonaPlano>) => {
    aplicar((p) => ({ ...p, zonas: p.zonas.map((z) => (z.id === id ? { ...z, ...cambios } : z)) }));
  }, [aplicar]);

  const cambiarElemento = useCallback((id: string, cambios: Partial<ElementoPlano>) => {
    aplicar((p) => ({ ...p, elementos: p.elementos.map((e) => (e.id === id ? { ...e, ...cambios } : e)) }));
  }, [aplicar]);

  const quitar = useCallback((sel: NonNullable<Seleccion>) => {
    aplicar((p) => ({
      ...p,
      mesas: sel.tipo === 'mesa' ? p.mesas.filter((m) => m.mesaId !== sel.id) : p.mesas,
      zonas: sel.tipo === 'zona' ? p.zonas.filter((z) => z.id !== sel.id) : p.zonas,
      elementos: sel.tipo === 'elemento' ? p.elementos.filter((e) => e.id !== sel.id) : p.elementos,
    }));
    setSeleccion(null);
  }, [aplicar]);

  const cambiarPlano = useCallback((cambios: Partial<Pick<Plano, 'ancho' | 'alto' | 'fondo'>>) => {
    aplicar((p) => ({ ...p, ...cambios }));
  }, [aplicar]);

  const reemplazar = useCallback((nuevo: Plano) => {
    aplicar(() => nuevo);
    setSeleccion(null);
  }, [aplicar]);

  const fijarNumero = useCallback((mesaId: string, numero: number) => {
    setNumeros((n) => ({ ...n, [mesaId]: numero }));
    setSucio(true);
  }, []);

  /** Números repetidos entre las mesas del plano (no se puede guardar así). */
  const repetidos = useMemo(() => {
    const vistos = new Map<number, number>();
    plano.mesas.forEach((m) => { const n = numeros[m.mesaId]; if (n) vistos.set(n, (vistos.get(n) ?? 0) + 1); });
    return new Set([...vistos.entries()].filter(([, c]) => c > 1).map(([n]) => n));
  }, [plano.mesas, numeros]);

  return {
    plano, seleccion, setSeleccion, numeros, sucio, setSucio, puedeDeshacer: historia.length > 0, repetidos,
    deshacer, mover, agregarMesa, agregarZona, agregarElemento, cambiarMesa, cambiarZona, cambiarElemento, quitar, cambiarPlano, reemplazar, fijarNumero, siguienteNumero,
  };
}

export type EditorPlano = ReturnType<typeof useEditorPlano>;
