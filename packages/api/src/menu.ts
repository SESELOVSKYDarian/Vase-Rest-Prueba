import type { Centavos } from '@vase/domain';
import { aCentavos } from '@vase/domain';
import { consultarDb } from './db';
import { apiFetch } from './http';

export interface CategoriaMenu {
  id: string;
  nombre: string;
  orden: number;
}

export interface ProductoMenu {
  id: string;
  categoriaId: string | null;
  nombre: string;
  descripcion: string;
  precio: Centavos;
  disponible: boolean;
  /** Ruta de la foto en el servidor (/uploads/...), o null. */
  imagenUrl: string | null;
}

interface ProductoFila {
  id: string;
  categoria_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio: string | number;
  disponible: boolean;
  activo: boolean | null;
  imagen_url: string | null;
}

export async function obtenerCategorias(): Promise<CategoriaMenu[]> {
  const filas = await consultarDb<Array<{ id: string; nombre: string; orden: number | null; activo: boolean | null }>>({
    table: 'categorias',
    selection: 'id, nombre, orden, activo',
    orders: [{ column: 'orden', ascending: true }],
  });
  return (filas ?? []).filter((c) => c.activo !== false).map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden ?? 0 }));
}

export async function obtenerProductos(): Promise<ProductoMenu[]> {
  const filas = await consultarDb<ProductoFila[]>({
    table: 'productos',
    selection: 'id, categoria_id, nombre, descripcion, precio, disponible, activo, imagen_url',
    orders: [{ column: 'nombre', ascending: true }],
  });
  return (filas ?? [])
    .filter((p) => p.activo !== false)
    .map((p) => ({
      id: p.id,
      categoriaId: p.categoria_id,
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      // `precio` es numeric en pesos; el dominio trabaja en centavos enteros.
      precio: aCentavos(Number(p.precio)),
      disponible: p.disponible,
      imagenUrl: p.imagen_url,
    }));
}

export interface CambiosProducto {
  nombre?: string;
  descripcion?: string;
  precio?: Centavos;
  categoriaId?: string | null;
  disponible?: boolean;
  imagenUrl?: string | null;
}

export async function actualizarProducto(id: string, cambios: CambiosProducto): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) payload.nombre = cambios.nombre.trim();
  if (cambios.descripcion !== undefined) payload.descripcion = cambios.descripcion.trim();
  if (cambios.precio !== undefined) payload.precio = cambios.precio / 100;
  if (cambios.categoriaId !== undefined) payload.categoria_id = cambios.categoriaId;
  if (cambios.disponible !== undefined) payload.disponible = cambios.disponible;
  if (cambios.imagenUrl !== undefined) payload.imagen_url = cambios.imagenUrl;
  await consultarDb({ table: 'productos', operation: 'update', payload, filters: [{ method: 'eq', column: 'id', value: id }] });
}

export async function crearProducto(datos: { nombre: string; descripcion: string; precio: Centavos; categoriaId: string | null; imagenUrl: string | null }): Promise<void> {
  await consultarDb({
    table: 'productos',
    operation: 'insert',
    payload: { nombre: datos.nombre.trim(), descripcion: datos.descripcion.trim(), precio: datos.precio / 100, categoria_id: datos.categoriaId, imagen_url: datos.imagenUrl, disponible: true, activo: true, stock: 0, stock_actual: 0 },
  });
}

/** Carta pública (sin sesión) para el QR de la mesa. */
export interface CartaPublica {
  categorias: CategoriaMenu[];
  productos: ProductoMenu[];
}

export async function obtenerCartaPublica(): Promise<CartaPublica> {
  const r = await apiFetch<{ categorias: CategoriaMenu[]; productos: Array<Omit<ProductoMenu, 'precio'> & { precio: number }> }>('/public/carta');
  return { categorias: r.categorias, productos: r.productos.map((p) => ({ ...p, precio: aCentavos(p.precio) })) };
}

/** Saca un plato de la carta sin borrarlo (los pedidos y facturas viejos lo siguen nombrando). */
export async function archivarProducto(id: string): Promise<void> {
  await consultarDb({ table: 'productos', operation: 'update', payload: { activo: false, disponible: false }, filters: [{ method: 'eq', column: 'id', value: id }] });
}
