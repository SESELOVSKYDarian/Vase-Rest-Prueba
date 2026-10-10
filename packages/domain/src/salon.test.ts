import { describe, expect, it } from 'vitest';
import { alertaMesa, intensidadesCalor, iniciales, ordenarPorCarga, sugerirMozo, type CargaMozo } from './salon';

describe('alertaMesa', () => {
  it('mesa libre o con problema no alerta', () => {
    expect(alertaMesa({ estadoMesa: 'libre' }).nivel).toBe('ok');
    expect(alertaMesa({ estadoMesa: 'problema', estadoPedido: 'listo', minEnEstado: 99 }).nivel).toBe('ok');
  });
  it('plato listo sin servir escala rápido', () => {
    expect(alertaMesa({ estadoMesa: 'pedido_listo', estadoPedido: 'listo', minEnEstado: 2 }).nivel).toBe('ok');
    expect(alertaMesa({ estadoMesa: 'pedido_listo', estadoPedido: 'listo', minEnEstado: 4 }).nivel).toBe('atencion');
    const u = alertaMesa({ estadoMesa: 'pedido_listo', estadoPedido: 'listo', minEnEstado: 7 });
    expect(u.nivel).toBe('urgente');
    expect(u.motivo).toBe('Listo hace 7 min, sin servir');
  });
  it('preparando tolera más que listo', () => {
    expect(alertaMesa({ estadoMesa: 'esperando_pedido', estadoPedido: 'preparando', minEnEstado: 15 }).nivel).toBe('ok');
    expect(alertaMesa({ estadoMesa: 'esperando_pedido', estadoPedido: 'en_preparacion', minEnEstado: 36 }).nivel).toBe('urgente');
  });
  it('pedido sin tomar, cuenta y sentados sin pedido', () => {
    expect(alertaMesa({ estadoMesa: 'esperando_pedido', estadoPedido: 'pendiente', minEnEstado: 11 }).motivo).toMatch(/sin tomar/);
    expect(alertaMesa({ estadoMesa: 'para_cobrar', estadoPedido: 'lista_para_cobrar', minEnEstado: 6 }).nivel).toBe('atencion');
    expect(alertaMesa({ estadoMesa: 'ocupada', minOcupada: 16 })).toEqual({ nivel: 'urgente', motivo: 'Sentados hace 16 min sin pedido' });
  });
  it('estadía larga se suma y gana el peor nivel', () => {
    const a = alertaMesa({ estadoMesa: 'ocupada', estadoPedido: 'entregado', minEnEstado: 10, minOcupada: 155 });
    expect(a.nivel).toBe('urgente');
    expect(a.motivo).toBe('Ocupada hace 2 h 35 min');
    const b = alertaMesa({ estadoMesa: 'pedido_listo', estadoPedido: 'listo', minEnEstado: 7, minOcupada: 110 });
    expect(b.nivel).toBe('urgente');
    expect(b.motivo).toMatch(/sin servir/);
  });
});

const mozo = (id: string, p: Partial<CargaMozo> = {}): CargaMozo => ({ id, nombre: id, mesasActivas: 0, comensalesActivos: 0, asignadasEnTurno: 0, ultimaAsignacion: null, ...p });

describe('reparto de mesas', () => {
  it('sugiere a quien tiene menos trabajo abierto', () => {
    const m = [mozo('ana', { mesasActivas: 3, comensalesActivos: 9 }), mozo('beto', { mesasActivas: 1, comensalesActivos: 2 }), mozo('carla', { mesasActivas: 2, comensalesActivos: 4 })];
    expect(sugerirMozo(m)?.id).toBe('beto');
  });
  it('a igual trabajo, a quien recibió menos mesas en el turno, y luego al que hace más que no recibe', () => {
    expect(sugerirMozo([mozo('ana', { asignadasEnTurno: 5 }), mozo('beto', { asignadasEnTurno: 3 })])?.id).toBe('beto');
    expect(sugerirMozo([mozo('ana', { ultimaAsignacion: 2000 }), mozo('beto', { ultimaAsignacion: 1000 }), mozo('carla', { ultimaAsignacion: 3000 })])?.id).toBe('beto');
  });
  it('sin mozos no hay sugerencia y no se muta la entrada', () => {
    expect(sugerirMozo([])).toBeNull();
    const m = [mozo('b', { mesasActivas: 2 }), mozo('a')];
    ordenarPorCarga(m);
    expect(m[0].id).toBe('b');
  });
  it('iniciales', () => {
    expect(iniciales('Ana Pérez')).toBe('AP');
    expect(iniciales('Mozo')).toBe('MO');
    expect(iniciales('Juan Carlos Gómez')).toBe('JG');
    expect(iniciales('  ')).toBe('?');
  });
});

describe('mapa de calor', () => {
  it('normaliza contra la mejor mesa y descarta las que no tienen dato', () => {
    const calor = [
      { mesaId: 'a', ventas: 1000, pedidos: 4, rotacion: 2, permanenciaMin: 50 },
      { mesaId: 'b', ventas: 500, pedidos: 2, rotacion: 1, permanenciaMin: null },
      { mesaId: 'c', ventas: 0, pedidos: 0, rotacion: 0, permanenciaMin: null },
    ];
    const v = intensidadesCalor(calor, 'ventas');
    expect(v.get('a')).toBe(1);
    expect(v.get('b')).toBe(0.5);
    expect(v.has('c')).toBe(false);
    expect(intensidadesCalor(calor, 'permanencia').has('b')).toBe(false);
  });
});
