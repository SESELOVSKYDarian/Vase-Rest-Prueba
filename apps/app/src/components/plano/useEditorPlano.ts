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
      if (tipo === 'zona') {
        // Una zona se lleva puesto lo que tiene adentro (mesas y objetos): se mueve el ambiente completo.
        const z = p.zonas.find((x) => x.id === id);
        if (!z) return p;
        const dentro = (x: number, y: number) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
        const ddx = ajustar(dx);
        const ddy = ajustar(dy);
        return {
          ...p,
          zonas: p.zonas.map((q) => (q.id === id ? { ...q, x: q.x + ddx, y: q.y + ddy } : q)),
          mesas: p.mesas.map((m) => (dentro(m.x, m.y) ? { ...m, x: m.x + ddx, y: m.y + ddy } : m)),
          elementos: p.elementos.map((e) => (dentro(e.x, e.y) ? { ...e, x: e.x + ddx, y: e.y + ddy } : e)),
        };
      }
      if (tipo === 'mesa') return { ...p, mesas: p.mesas.map((m) => (m.mesaId === id ? { ...m, ...limitar(p, ajustar(m.x + dx), ajustar(m.y + dy)) } : m)) };
      if (tipo === 'elemento') return { ...p, elementos: p.elementos.map((e) => (e.id === id ? { ...e, ...limitar(p, ajustar(e.x + dx), ajustar(e.y + dy)) } : e)) };
      return p;
    });
  }, [aplicar]);

  /** Estira una zona u objeto desde su esquina inferior derecha (la superior izquierda queda fija). */
  const redimensionar = useCallback((tipo: 'zona' | 'elemento', id: string, dw: number, dh: number) => {
    aplicar((p) => {
      if (tipo === 'zona') {
        return { ...p, zonas: p.zonas.map((z) => (z.id === id ? { ...z, w: Math.max(100, ajustar(z.w + dw)), h: Math.max(100, ajustar(z.h + dh)) } : z)) };
      }
      return {
        ...p,
        elementos: p.elementos.map((e) => {
          if (e.id !== id) return e;
          const w = Math.max(10, ajustar(e.w + dw));
          const h = Math.max(10, ajustar(e.h + dh));
          // Los objetos se guardan por su centro: al estirar desde la esquina el centro se corre la mitad.
          return { ...e, w, h, x: e.x + (w - e.w) / 2, y: e.y + (h - e.h) / 2 };
        }),
      };
    });
  }, [aplicar]);

  /** Copia lo elegido un poco más abajo y a la derecha, y lo deja elegido. */
  const duplicar = useCallback((sel: NonNullable<Seleccion>) => {
    const salto = 80;
    if (sel.tipo === 'mesa') {
      const m = plano.mesas.find((x) => x.mesaId === sel.id);
      if (!m) return;
      const mesaId = nuevoId('nueva');
      setNumeros((n) => ({ ...n, [mesaId]: Math.max(0, ...Object.values(n)) + 1 }));
      aplicar((p) => ({ ...p, mesas: [...p.mesas, { ...m, mesaId, ...lugarLibre(p, m.ancho + 100, m.alto + 100, { x: m.x + salto, y: m.y + salto }) }] }));
      setSeleccion({ tipo: 'mesa', id: mesaId });
    } else if (sel.tipo === 'zona') {
      const z = plano.zonas.find((x) => x.id === sel.id);
      if (!z) return;
      const id = nuevoId('zona');
      aplicar((p) => ({ ...p, zonas: [...p.zonas, { ...z, id, nombre: `${z.nombre} 2`, x: z.x + salto, y: z.y + salto }] }));
      setSeleccion({ tipo: 'zona', id });
    } else {
      const e = plano.elementos.find((x) => x.id === sel.id);
      if (!e) return;
      const id = nuevoId('el');
      aplicar((p) => ({ ...p, elementos: [...p.elementos, { ...e, id, x: e.x + salto, y: e.y + salto }] }));
      setSeleccion({ tipo: 'elemento', id });
    }
  }, [plano, aplicar]);

  /** Achica o agranda el local hasta abarcar justo lo dibujado, con un margen. */
  const ajustarAlContenido = useCallback(() => {
    aplicar((p) => {
      const margen = 120;
      const silla = 80;
      const xs = [...p.zonas.map((z) => z.x + z.w), ...p.mesas.map((m) => m.x + m.ancho / 2 + silla), ...p.elementos.map((e) => e.x + Math.max(e.w, e.h) / 2)];
      const ys = [...p.zonas.map((z) => z.y + z.h), ...p.mesas.map((m) => m.y + m.alto / 2 + silla), ...p.elementos.map((e) => e.y + Math.max(e.w, e.h) / 2)];
      if (!xs.length) return p;
      const ancho = Math.min(10000, Math.max(600, ajustar(Math.max(...xs) + margen, 50)));
      const alto = Math.min(10000, Math.max(400, ajustar(Math.max(...ys) + margen, 50)));
      return ancho === p.ancho && alto === p.alto ? p : { ...p, ancho, alto };
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

  const cambiarPlano = useCallback((cambios: Partial<Pick<Plano, 'ancho' | 'alto' | 'fondo' | 'estilo'>>) => {
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
    deshacer, mover, redimensionar, duplicar, ajustarAlContenido, agregarMesa, agregarZona, agregarElemento, cambiarMesa, cambiarZona, cambiarElemento, quitar, cambiarPlano, reemplazar, fijarNumero, siguienteNumero,
  };
}

export type EditorPlano = ReturnType<typeof useEditorPlano>;
