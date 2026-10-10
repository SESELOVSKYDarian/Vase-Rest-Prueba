import { describe, expect, it } from 'vitest';
import { calcularCuenta, dividirEnPartesIguales, dividirPorComensal } from './cuenta';
import { aCentavos, formatearARS, parsearPesos, repartirEquitativo } from './dinero';

describe('dinero', () => {
  it('convierte pesos a centavos sin error de punto flotante', () => {
    expect(aCentavos(0.1 + 0.2)).toBe(30);
    expect(aCentavos(1234.56)).toBe(123456);
  });
  it('reparte sin perder ni inventar centavos', () => {
    const partes = repartirEquitativo(10000, 3);
    expect(partes).toEqual([3334, 3333, 3333]);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(10000);
  });
  it('rechaza entradas inválidas', () => {
    expect(() => repartirEquitativo(100, 0)).toThrow(RangeError);
    expect(() => repartirEquitativo(1.5, 2)).toThrow(RangeError);
  });
  it('formatea en pesos argentinos', () => {
    expect(formatearARS(123456)).toMatch(/1\.234,56/);
    expect(formatearARS(500000, true)).toMatch(/5\.000/);
  });
});

describe('cuenta', () => {
  const items = [
    { id: 'a', nombre: 'Milanesa', cantidad: 2, precioUnitario: 850000, comensal: 0 },
    { id: 'b', nombre: 'Cerveza', cantidad: 3, precioUnitario: 320000, comensal: 1 },
    { id: 'c', nombre: 'Postre compartido', cantidad: 1, precioUnitario: 400000 },
  ];
  it('calcula subtotal, descuento y propina', () => {
    const cuenta = calcularCuenta(items, { descuentoPorcentaje: 10, propina: { tipo: 'porcentaje', valor: 10 } });
    expect(cuenta.subtotal).toBe(3060000);
    expect(cuenta.descuento).toBe(306000);
    expect(cuenta.propina).toBe(275400);
    expect(cuenta.total).toBe(3029400);
  });
  it('suma impuestos del servidor antes de calcular la propina', () => {
    const cuenta = calcularCuenta(items, { impuestos: 642600, propina: { tipo: 'porcentaje', valor: 10 } });
    expect(cuenta.subtotal).toBe(3060000);
    expect(cuenta.impuestos).toBe(642600);
    expect(cuenta.propina).toBe(370260);
    expect(cuenta.total).toBe(3060000 + 642600 + 370260);
  });
  it('divide en partes iguales y siempre suma el total', () => {
    const partes = dividirEnPartesIguales(3029400, 4);
    expect(partes.reduce((s, p) => s + p.total, 0)).toBe(3029400);
  });
  it('divide por comensal repartiendo lo compartido', () => {
    const partes = dividirPorComensal(items, 2);
    expect(partes[0].total).toBe(1700000 + 200000);
    expect(partes[1].total).toBe(960000 + 200000);
    expect(partes.reduce((s, p) => s + p.total, 0)).toBe(3060000);
  });
});

import { tiempoTranscurrido } from './tiempo';
describe('tiempoTranscurrido', () => {
  const ahora = new Date('2026-10-10T12:00:00Z').getTime();
  it('formatea minutos, horas y días', () => {
    expect(tiempoTranscurrido(new Date(ahora - 20_000), ahora)).toBe('recién');
    expect(tiempoTranscurrido(new Date(ahora - 12 * 60_000), ahora)).toBe('hace 12 min');
    expect(tiempoTranscurrido(new Date(ahora - 65 * 60_000), ahora)).toBe('hace 1 h 5 min');
    expect(tiempoTranscurrido(new Date(ahora - 120 * 60_000), ahora)).toBe('hace 2 h');
    expect(tiempoTranscurrido(new Date(ahora - 49 * 3600_000), ahora)).toBe('hace 2 días');
  });
});

describe('parsearPesos', () => {
  it('entiende el formato argentino', () => {
    expect(parsearPesos('12.500')).toBe(1_250_000);
    expect(parsearPesos('12500,50')).toBe(1_250_050);
    expect(parsearPesos('$ 1.234,5')).toBe(123_450);
    expect(parsearPesos('9.5')).toBe(950);
    expect(parsearPesos('abc')).toBeNull();
    expect(parsearPesos('')).toBeNull();
  });
});
