/** Normaliza lo que escribe la persona: "192.168.0.10" → http://192.168.0.10:3001/api */
export function normalizarUrlServidor(entrada: string): string {
  let url = entrada.trim().replace(/\/+$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  const sinProtocolo = url.replace(/^https?:\/\//i, '');
  const tienePuerto = /:\d+(\/|$)/.test(sinProtocolo);
  const esLocal = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:|\/|$)/.test(sinProtocolo);
  if (!tienePuerto && esLocal) url = url.replace(/^(https?:\/\/[^/]+)/i, '$1:3001');
  if (!/\/api$/i.test(url)) url = `${url}/api`;
  return url;
}

/** Comprueba que el servidor responde y que la base está viva (GET /health, fuera de /api). */
export async function probarServidor(baseUrl: string, timeoutMs = 4000): Promise<{ ok: boolean; mensaje: string }> {
  const origen = baseUrl.replace(/\/api\/?$/i, '');
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), timeoutMs);
  try {
    const respuesta = await fetch(`${origen}/health`, { signal: control.signal });
    if (!respuesta.ok) return { ok: false, mensaje: `El servidor respondió ${respuesta.status}` };
    const cuerpo = await respuesta.json().catch(() => null);
    return cuerpo?.status === 'ok' ? { ok: true, mensaje: 'Conectado' } : { ok: false, mensaje: 'El servidor no tiene la base de datos disponible' };
  } catch {
    return { ok: false, mensaje: 'No se pudo conectar. Revisá la dirección y que estés en la misma red.' };
  } finally {
    clearTimeout(timer);
  }
}
