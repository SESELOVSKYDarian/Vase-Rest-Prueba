import { apiFetch } from './http';

export type RolSistema = 'admin' | 'encargado' | 'mozo' | 'cocina' | 'cajero' | 'soporte' | 'stock' | 'delivery' | 'desarrollador';

export interface Usuario {
  id: string;
  nombre: string;
  username: string;
  email: string;
  rol: RolSistema;
}

export interface Sesion {
  token: string;
  usuario: Usuario;
}

export const iniciarSesion = (usuario: string, password: string) =>
  apiFetch<Sesion>('/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) });
