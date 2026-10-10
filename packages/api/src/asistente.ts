import { apiFetch } from './http';
import type { Etiqueta } from './menu';

/** Asistente del personal (órdenes y pedidos dictados) y ajustes de la carta. Precios de acá en pesos, como los guarda la base. */
export interface ProductoAfectado { id: string; nombre: string; precioActual: number; precioNuevo?: number; disponible: boolean }

export interface AccionAsistente {
  tipo: 'agotado' | 'disponible' | 'precio_pct' | 'precio_fijo';
  alcance: 'todo' | 'categoria' | 'productos';
  categoriaId?: string | null;
  pct?: number;
  precio?: number;
  resumen: string;
  productos: ProductoAfectado[];
}

export interface ResultadoComando {
  acciones: AccionAsistente[];
  respuesta: { tipo: 'agotados'; productos: ProductoAfectado[] } | null;
  noEntendido: string[];
  fuente: 'local' | 'ia';
}

export const interpretarComando = (texto: string) =>
  apiFetch<ResultadoComando>('/carta-admin/asistente/comando', { method: 'POST', body: JSON.stringify({ texto }) });

export const ejecutarAcciones = (acciones: AccionAsistente[]) =>
  apiFetch<{ ok: boolean; cambios: Array<{ id: string; nombre: string; tipo: string; antes?: number; despues?: number }> }>('/carta-admin/asistente/ejecutar', { method: 'POST', body: JSON.stringify({ acciones }) });

export interface LineaDictada {
  productoId: string;
  nombre: string;
  cantidad: number;
  notas: string;
  agotado: boolean;
  ambiguo: boolean;
  alternativas: Array<{ id: string; nombre: string }>;
}

export const interpretarPedidoDictado = (texto: string) =>
  apiFetch<{ lineas: LineaDictada[]; noEntendido: string[] }>('/carta-admin/asistente/pedido', { method: 'POST', body: JSON.stringify({ texto }) });

export interface AjustesCarta {
  nombreLocal: string;
  ivaIncluido: boolean;
  idiomas: Array<'en' | 'pt'>;
  pedidosQr: boolean;
  happyHour: { activo: boolean; dias: number[]; desde: string; hasta: string; descuento: number; categorias: string[] };
  pago: { alias: string; titular: string; mensaje: string };
  propinas: number[];
  reservas: { activas: boolean; duracionMin: number; desde: string; hasta: string; maxPersonas: number; anticipacionMin: number };
  llevar: { activo: boolean; demoraMin: number; maxUnidades: number };
  fiscal: { razonSocial: string; cuit: string; condicionIva: 'responsable_inscripto' | 'monotributo' | 'exento'; domicilio: string; pedirFactura: boolean };
}

export interface RespuestaAjustes {
  config: AjustesCarta;
  integraciones: { mercadopago: boolean; ia: 'gemini' | 'groq' | 'anthropic' | null };
  etiquetas: Etiqueta[];
}

export const obtenerAjustes = () => apiFetch<RespuestaAjustes>('/carta-admin/config');
export const guardarAjustes = (config: AjustesCarta) => apiFetch<{ config: AjustesCarta }>('/carta-admin/config', { method: 'PUT', body: JSON.stringify({ config }) });
export const guardarEtiquetas = (productoId: string, etiquetas: Etiqueta[]) =>
  apiFetch<{ ok: boolean; etiquetas: Etiqueta[] }>(`/carta-admin/productos/${productoId}/etiquetas`, { method: 'PUT', body: JSON.stringify({ etiquetas }) });

export interface ResenasLocal { promedio: number | null; total: number; resenas: Array<{ estrellas: number; comentario: string; mesa: number | null; creadaEn: string }> }
export const obtenerResenas = () => apiFetch<ResenasLocal>('/carta-admin/resenas');
