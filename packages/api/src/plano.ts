import { normalizarPlano, type AnalisisPlano, type FormaMesa, type Plano } from '@vase/domain';
import { apiFetch } from './http';
import { consultarDb } from './db';

const ID_PLANO = 'plano-v2';

/** Plano guardado (null si todavía no se armó ninguno). */
export async function obtenerPlano(): Promise<Plano | null> {
  const fila = await consultarDb<{ payload: unknown } | null>({
    table: 'salon_layouts',
    selection: 'payload',
    filters: [{ method: 'eq', column: 'id', value: ID_PLANO }],
    single: 'maybe',
  });
  return fila ? normalizarPlano(fila.payload) : null;
}

export async function guardarPlano(plano: Plano): Promise<void> {
  await consultarDb({
    table: 'salon_layouts',
    operation: 'upsert',
    payload: { id: ID_PLANO, payload: plano, updated_at: new Date().toISOString() },
  });
}

/** Lleva al registro de cada mesa lo que define el plano: zona, forma, lugares y posición. */
export async function sincronizarMesasConPlano(
  cambios: Array<{ mesaId: string; numero?: number; zona: string | null; forma: FormaMesa; capacidad: number; x: number; y: number }>,
): Promise<void> {
  for (const c of cambios) {
    await consultarDb({
      table: 'mesas',
      operation: 'update',
      payload: { forma: c.forma, capacidad: c.capacidad, pos_x: Math.round(c.x), pos_y: Math.round(c.y), ...(c.zona ? { zona: c.zona } : {}), ...(c.numero ? { numero: c.numero } : {}) },
      filters: [{ method: 'eq', column: 'id', value: c.mesaId }],
    });
  }
}

export async function crearMesa(datos: { numero: number; capacidad: number; zona: string; forma: FormaMesa }): Promise<string> {
  const fila = await consultarDb<{ id: string }>({
    table: 'mesas',
    operation: 'insert',
    payload: { numero: datos.numero, capacidad: datos.capacidad, zona: datos.zona, forma: datos.forma, estado: 'libre', disponible: true },
    selection: 'id',
    single: 'single',
  });
  return fila.id;
}

/** Pide al servidor que lea una imagen ya subida y proponga mesas, zonas y elementos. */
export async function analizarPlano(url: string): Promise<AnalisisPlano> {
  return apiFetch<AnalisisPlano>('/plano/analizar', { method: 'POST', body: JSON.stringify({ url }) });
}
