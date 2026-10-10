import { describe, expect, it } from 'vitest';
import { normalizarUrlServidor } from './servidor';

describe('normalizarUrlServidor', () => {
  it('completa protocolo, puerto y /api para una IP de la red local', () => {
    expect(normalizarUrlServidor('192.168.0.10')).toBe('http://192.168.0.10:3001/api');
  });
  it('respeta puertos y rutas existentes', () => {
    expect(normalizarUrlServidor('http://192.168.0.10:4000/api/')).toBe('http://192.168.0.10:4000/api');
    expect(normalizarUrlServidor('https://local.mirestaurante.com.ar')).toBe('https://local.mirestaurante.com.ar/api');
  });
  it('devuelve vacío si no se escribió nada', () => {
    expect(normalizarUrlServidor('  ')).toBe('');
  });
});
