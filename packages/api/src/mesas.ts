import type { EstadoMesa, FormaMesa, Mesa } from '@vase/domain';
import { consultarDb } from './db';

interface MesaFila {
  id: string | number;
  numero: number;
  capacidad: number | null;
  zona?: string | null;
  ubicacion?: string | null;
  disponible?: boolean | null;
  estado?: string | null;
  forma?: string | null;
  pos_x?: string | number | null;
  pos_y?: string | number | null;
  personas?: number | null;
}

const ESTADOS_VALIDOS: readonly EstadoMesa[] = ['libre', 'ocupada', 'esperando_pedido', 'pedido_listo', 'esperando_pago', 'para_cobrar', 'problema'];

export function normalizarForma(forma?: string | null): FormaMesa {
  if (forma === 'cuadrada') return 'cuadrada';
  if (forma === 'rectangular') return 'rectangular';
  return 'circular'; // 'circular', el legacy 'redonda' y vacíos
}

export function normalizarEstado(fila: Pick<MesaFila, 'estado' | 'disponible'>): EstadoMesa {
  if (fila.estado === 'reservada') return 'esperando_pedido';
  if (fila.estado && (ESTADOS_VALIDOS as readonly string[]).includes(fila.estado)) return fila.estado as EstadoMesa;
  if (fila.disponible === false) return 'problema';
  return 'libre';
}

export function mapearMesa(fila: MesaFila): Mesa {
  return {
    id: String(fila.id),
    numero: fila.numero,
    zona: fila.zona || fila.ubicacion || 'Salón',
    estado: normalizarEstado(fila),
    capacidad: fila.capacidad ?? 0,
    forma: normalizarForma(fila.forma),
    personas: fila.personas ?? undefined,
    // pos_x/pos_y son `numeric` en Postgres: el driver los entrega como string.
    posicion: { x: Number(fila.pos_x) || 0, y: Number(fila.pos_y) || 0 },
  };
}

export async function obtenerMesas(): Promise<Mesa[]> {
  const filas = await consultarDb<MesaFila[]>({
    table: 'mesas',
    selection: 'id, numero, capacidad, zona, disponible, estado, forma, pos_x, pos_y',
    orders: [{ column: 'numero', ascending: true }],
  });
  return (filas ?? []).map(mapearMesa);
}
