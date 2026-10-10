import type { Centavos } from '@vase/domain';
import { aCentavos } from '@vase/domain';
import { consultarDb } from './db';

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
}

interface ProductoFila {
  id: string;
  categoria_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio: string | number;
  disponible: boolean;
  activo: boolean | null;
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
    selection: 'id, categoria_id, nombre, descripcion, precio, disponible, activo',
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
    }));
}
