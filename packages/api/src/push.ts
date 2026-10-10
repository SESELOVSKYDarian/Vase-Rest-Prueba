import { apiFetch } from './http';

/** Registra el celular para recibir avisos con la pantalla bloqueada. */
export const registrarDispositivoPush = (token: string, plataforma: string) =>
  apiFetch<{ ok: boolean }>('/push/registrar', { method: 'POST', body: JSON.stringify({ token, plataforma }) });
export const quitarDispositivoPush = (token: string) =>
  apiFetch<{ ok: boolean }>('/push/quitar', { method: 'POST', body: JSON.stringify({ token }) });
