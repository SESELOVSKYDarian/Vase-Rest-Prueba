import { apiFetch, getApiBaseUrl } from './http';

/** Sube una imagen (JPG/PNG/WebP en base64) y devuelve su ruta en el servidor. */
export async function subirImagen(base64: string): Promise<string> {
  const respuesta = await apiFetch<{ url: string }>('/archivos', { method: 'POST', body: JSON.stringify({ base64 }) });
  return respuesta.url;
}

/** Convierte una ruta del servidor (/uploads/...) en una URL completa para mostrarla. */
export function urlArchivo(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  if (/^(https?:|data:|blob:|file:)/i.test(ruta)) return ruta;
  return `${getApiBaseUrl().replace(/\/api\/?$/i, '')}${ruta.startsWith('/') ? '' : '/'}${ruta}`;
}
