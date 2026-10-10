export type EstadoMesa =
  | 'libre'
  | 'ocupada'
  | 'esperando_pedido'
  | 'pedido_listo'
  | 'esperando_pago'
  | 'problema'
  | 'para_cobrar';

export type FormaMesa = 'circular' | 'cuadrada' | 'rectangular';

export interface Mesa {
  id: string;
  numero: number;
  zona: string;
  estado: EstadoMesa;
  capacidad: number;
  forma: FormaMesa;
  personas?: number;
  pedidoId?: string;
  /** Posición en unidades lógicas del plano (no píxeles). */
  posicion: { x: number; y: number };
}

/** Estados en el orden en que el personal los necesita ver. */
export const ESTADOS_MESA: readonly EstadoMesa[] = [
  'libre',
  'ocupada',
  'esperando_pedido',
  'pedido_listo',
  'esperando_pago',
  'para_cobrar',
  'problema',
] as const;

export const ETIQUETA_ESTADO_MESA: Record<EstadoMesa, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  esperando_pedido: 'Esperando pedido',
  pedido_listo: 'Pedido listo',
  esperando_pago: 'Esperando pago',
  para_cobrar: 'Para cobrar',
  problema: 'Problema',
};

/** Estados con comensales sentados: sirven para mostrar la ocupación. */
export const ESTADOS_CON_PERSONAS: ReadonlySet<EstadoMesa> = new Set<EstadoMesa>([
  'ocupada',
  'esperando_pedido',
  'pedido_listo',
  'esperando_pago',
  'para_cobrar',
]);

export function contarPorEstado(mesas: readonly Mesa[]): Record<EstadoMesa, number> {
  const base = Object.fromEntries(ESTADOS_MESA.map((estado) => [estado, 0])) as Record<EstadoMesa, number>;
  for (const mesa of mesas) base[mesa.estado] += 1;
  return base;
}

/** Agrupa por zona respetando el orden de aparición. */
export function agruparPorZona(mesas: readonly Mesa[]): Array<{ zona: string; mesas: Mesa[] }> {
  const zonas = new Map<string, Mesa[]>();
  for (const mesa of mesas) {
    const lista = zonas.get(mesa.zona) ?? [];
    lista.push(mesa);
    zonas.set(mesa.zona, lista);
  }
  return [...zonas.entries()].map(([zona, lista]) => ({ zona, mesas: lista.sort((a, b) => a.numero - b.numero) }));
}
