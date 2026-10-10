import { aCentavos, type Centavos } from '@vase/domain';
import { apiFetch } from './http';
import type { CategoriaMenu, Etiqueta } from './menu';

/** Carta que ve el cliente desde el QR: precios de este momento, idioma elegido y datos para vender. */
export type Idioma = 'es' | 'en' | 'pt';

export interface ProductoCarta {
  id: string;
  categoriaId: string | null;
  nombre: string;
  descripcion: string;
  /** Precio que rige ahora (con happy hour si corresponde). */
  precio: Centavos;
  precioLista: Centavos;
  happy: boolean;
  imagenUrl: string | null;
  disponible: boolean;
  etiquetas: Etiqueta[];
  masPedido: boolean;
  acompanamientos: string[];
}

export interface CartaPublica {
  local: string;
  idioma: Idioma;
  idiomas: Idioma[];
  ivaIncluido: boolean;
  pedidosQr: boolean;
  happyHour: { activo: boolean; vigente: boolean; descuento: number; desde: string; hasta: string; dias: number[] };
  categorias: CategoriaMenu[];
  productos: ProductoCarta[];
}

interface CartaBackend extends Omit<CartaPublica, 'productos'> {
  productos: Array<Omit<ProductoCarta, 'precio' | 'precioLista'> & { precio: number; precioLista: number }>;
}

export async function obtenerCartaPublica(idioma: Idioma = 'es'): Promise<CartaPublica> {
  const r = await apiFetch<CartaBackend>(`/public/carta?lang=${idioma}`);
  return { ...r, productos: r.productos.map((p) => ({ ...p, precio: aCentavos(p.precio), precioLista: aCentavos(p.precioLista) })) };
}

export interface Recomendacion {
  entendido: boolean;
  conceptos: string[];
  evita: string[];
  presupuesto: number | null;
  sinResultados: boolean;
  faltanEtiquetas: string[];
  ids: string[];
  motivos: Record<string, string[]>;
  /** Texto redactado por la IA (si hay una configurada); si no, la app arma el mensaje. */
  mensaje: string | null;
  fuente: 'ia' | 'local';
}

export const pedirRecomendacion = (texto: string, idioma: Idioma) =>
  apiFetch<Recomendacion>('/public/asistente', { method: 'POST', body: JSON.stringify({ texto, idioma }) });
