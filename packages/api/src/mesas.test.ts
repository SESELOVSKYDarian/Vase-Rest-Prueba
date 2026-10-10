import { describe, expect, it } from 'vitest';
import { mapearMesa, normalizarEstado, normalizarForma } from './mesas';

describe('mapearMesa', () => {
  it('convierte posiciones numeric (string) a número: "220" + 80 no concatena', () => {
    const mesa = mapearMesa({ id: 'x', numero: 5, capacidad: 4, pos_x: '220.00', pos_y: '460', forma: 'redonda' });
    expect(mesa.posicion).toEqual({ x: 220, y: 460 });
    expect(mesa.posicion.x + 80).toBe(300);
    expect(mesa.forma).toBe('circular');
  });
  it('normaliza estados legacy y desconocidos', () => {
    expect(normalizarEstado({ estado: 'reservada' })).toBe('esperando_pedido');
    expect(normalizarEstado({ estado: 'raro', disponible: false })).toBe('problema');
    expect(normalizarEstado({})).toBe('libre');
    expect(normalizarForma('cuadrada')).toBe('cuadrada');
  });
});
