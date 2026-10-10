import { aCentavos, type Centavos } from '@vase/domain';
import { apiFetch } from './http';

export type EstadoPedido = 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'cerrado' | 'cancelado' | string;

export interface ItemPedido {
  id: string;
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: Centavos;
  subtotal: Centavos;
  notas: string | null;
}

export interface Pedido {
  id: string;
  mesaId: string;
  mesaNumero: number;
  zona: string;
  estado: EstadoPedido;
  comensales: number;
  subtotal: Centavos;
  /** IVA que el servidor suma sobre el subtotal. */
  impuestos: Centavos;
  total: Centavos;
  abiertoEn: Date;
  mozoNombre: string | null;
  items: ItemPedido[];
}

interface PedidoBackend {
  id: string;
  mesaId: string;
  estado: string;
  comensales?: number | null;
  subtotal?: number | string | null;
  impuestos?: number | string | null;
  total?: number | string | null;
  abiertoEn?: string | null;
  createdAt?: string | null;
  mozoNombre?: string | null;
  mesa?: { numero: number; zona?: string | null } | null;
  items?: Array<{
    id: string;
    productoId: string;
    cantidad: number | string;
    precioUnitario: number | string;
    subtotal: number | string;
    notas?: string | null;
    producto?: { nombre?: string } | null;
  }>;
}

export function mapearPedido(p: PedidoBackend): Pedido {
  const items: ItemPedido[] = (p.items ?? []).map((item) => ({
    id: item.id,
    productoId: item.productoId,
    nombre: item.producto?.nombre ?? 'Producto',
    cantidad: Number(item.cantidad),
    precioUnitario: aCentavos(Number(item.precioUnitario)),
    subtotal: aCentavos(Number(item.subtotal)),
    notas: item.notas ?? null,
  }));
  return {
    id: p.id,
    mesaId: p.mesaId,
    mesaNumero: p.mesa?.numero ?? 0,
    zona: p.mesa?.zona ?? 'Salón',
    estado: p.estado,
    comensales: p.comensales ?? 0,
    subtotal: aCentavos(Number(p.subtotal ?? 0)) || items.reduce((s, i) => s + i.subtotal, 0),
    impuestos: aCentavos(Number(p.impuestos ?? 0)),
    // El total del servidor es la fuente de verdad; si no vino, se suma de los ítems.
    total: p.total != null ? aCentavos(Number(p.total)) : items.reduce((s, i) => s + i.subtotal, 0),
    abiertoEn: new Date(p.abiertoEn ?? p.createdAt ?? Date.now()),
    mozoNombre: p.mozoNombre ?? null,
    items,
  };
}

export async function obtenerPedidosActivos(): Promise<Pedido[]> {
  const respuesta = await apiFetch<{ pedidos: PedidoBackend[] }>('/pedidos?estado=pendiente,preparando,listo,entregado');
  return respuesta.pedidos.map(mapearPedido);
}

/** Abre el pedido de la mesa, o recupera el que ya tiene abierto. */
export async function abrirPedido(mesaId: string, comensales?: number): Promise<Pedido> {
  const respuesta = await apiFetch<{ pedido: PedidoBackend }>('/pedidos', {
    method: 'POST',
    body: JSON.stringify({ mesaId, comensales }),
  });
  return mapearPedido(respuesta.pedido);
}

export async function agregarProducto(pedidoId: string, productoId: string, cantidad: number, notas?: string): Promise<void> {
  await apiFetch(`/pedidos/${pedidoId}/productos`, {
    method: 'POST',
    body: JSON.stringify({ productoId, cantidad, notas }),
  });
}
