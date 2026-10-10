import { describe, expect, it } from 'vitest';
import { medidaMesa, normalizarPlano, planoDesdeMesas,
  lugarLibre, posicionesSillas, zonaDeMesa, tituloZona } from './plano';
import type { Mesa } from './mesa';

const mesa = (id: string, numero: number, x: number, y: number, zona = 'SALÓN PRINCIPAL'): Mesa => ({ id, numero, zona, estado: 'libre', capacidad: 4, forma: 'cuadrada', posicion: { x, y } });

describe('sillas', () => {
  it('una mesa redonda de 4 tiene 4 sillas equidistantes del centro', () => {
    const sillas = posicionesSillas({ forma: 'circular', ancho: 90, alto: 90, asientos: 4 });
    expect(sillas).toHaveLength(4);
    const distancias = sillas.map((s) => Math.hypot(s.x, s.y));
    distancias.forEach((d) => expect(d).toBeCloseTo(distancias[0]));
  });
  it('una rectangular de 5 pone 4 en los lados largos y 1 en la cabecera', () => {
    const sillas = posicionesSillas({ forma: 'rectangular', ancho: 200, alto: 80, asientos: 5 });
    expect(sillas).toHaveLength(5);
    expect(sillas.filter((s) => s.rot === 90)).toHaveLength(1);
  });
  it('ninguna silla queda dentro de la mesa', () => {
    for (const forma of ['circular', 'cuadrada', 'rectangular'] as const) {
      for (const n of [1, 2, 4, 6, 8]) {
        const medida = medidaMesa(forma, n);
        posicionesSillas({ forma, asientos: n, ...medida }).forEach((s) => {
          const adentro = forma === 'circular'
            ? Math.hypot(s.x, s.y) < medida.ancho / 2
            : Math.abs(s.x) < medida.ancho / 2 && Math.abs(s.y) < medida.alto / 2;
          expect(adentro).toBe(false);
        });
      }
    }
  });
});

describe('normalizarPlano', () => {
  it('rechaza basura y versiones viejas', () => {
    expect(normalizarPlano(null)).toBeNull();
    expect(normalizarPlano({ version: 1 })).toBeNull();
  });
  it('descarta elementos inválidos y acota valores', () => {
    const plano = normalizarPlano({ version: 2, ancho: 99999, alto: 'x', mesas: [{ mesaId: 'a', forma: 'triangular', asientos: 99 }, { sinId: true }], zonas: [{ id: 'z', nombre: '', color: 'fucsia' }], elementos: [{ id: 'e', tipo: 'nave' }] });
    expect(plano?.ancho).toBe(10000);
    expect(plano?.alto).toBe(800);
    expect(plano?.mesas).toHaveLength(1);
    expect(plano?.mesas[0].forma).toBe('cuadrada');
    expect(plano?.mesas[0].asientos).toBe(20);
    expect(plano?.zonas[0]).toMatchObject({ nombre: 'Zona', color: 'salvia' });
    expect(plano?.elementos).toHaveLength(0);
  });
});

describe('planoDesdeMesas', () => {
  it('arma zonas alrededor de sus mesas y deja margen', () => {
    const plano = planoDesdeMesas([mesa('a', 1, 220, 460), mesa('b', 2, 440, 460), mesa('c', 3, 900, 460, 'TERRAZA')]);
    expect(plano.zonas.map((z) => z.nombre).sort()).toEqual(['Salón principal', 'Terraza']);
    plano.mesas.forEach((m) => {
      expect(zonaDeMesa(plano, m)).not.toBeNull();
      expect(m.x - m.ancho / 2).toBeGreaterThan(0);
    });
  });
  it('sin posiciones guardadas acomoda en grilla', () => {
    const plano = planoDesdeMesas([mesa('a', 1, 0, 0), mesa('b', 2, 0, 0)]);
    expect(plano.mesas[0].x).not.toBe(plano.mesas[1].x);
  });
  it('ignora posiciones corruptas (restos del bug de concatenación)', () => {
    const plano = planoDesdeMesas([mesa('a', 1, 220808080, 460808080), mesa('b', 2, 440, 460)]);
    expect(plano.ancho).toBeLessThan(5000);
  });
  it('busca lugar libre sin pisar otras mesas', () => {
    const plano = planoDesdeMesas([mesa('a', 1, 400, 300)]);
    const ocupada = plano.mesas[0];
    const lugar = lugarLibre(plano, 90, 90, { x: ocupada.x, y: ocupada.y });
    const libreX = Math.abs(lugar.x - ocupada.x) * 2 >= ocupada.ancho + 100 + 90;
    const libreY = Math.abs(lugar.y - ocupada.y) * 2 >= ocupada.alto + 100 + 90;
    expect(libreX || libreY).toBe(true);
    // Cerca: no se va a la otra punta del local.
    expect(Math.hypot(lugar.x - ocupada.x, lugar.y - ocupada.y)).toBeLessThan(260);
    expect(lugar.x).toBeGreaterThan(0);
  });
  it('titula zonas', () => expect(tituloZona('  SALÓN PRINCIPAL ')).toBe('Salón principal'));
});

import { planoDesdeAnalisis } from './plano';
describe('planoDesdeAnalisis', () => {
  const analisis = {
    es_plano: true,
    local: { ancho_m: 10, largo_m: 6 },
    zonas: [{ nombre: 'Terraza', x: 0, y: 0, w: 500, h: 1000 }],
    mesas: [
      { forma: 'circular' as const, lugares: 4, x: 250, y: 500, rot: 0, numero: 2 },
      { forma: 'rectangular' as const, lugares: 6, x: 750, y: 500, rot: 90, numero: null },
    ],
    elementos: [{ tipo: 'barra' as const, x: 500, y: 950, w: 400, h: 60, rot: 0, etiqueta: null }],
    notas: '',
  };
  it('escala a cm reales y reutiliza mesas existentes por número', () => {
    const { plano, numeros } = planoDesdeAnalisis(analisis, [mesa('m2', 2, 0, 0), mesa('m7', 7, 0, 0)], null);
    expect(plano.ancho).toBe(1000);
    expect(plano.alto).toBe(600);
    expect(plano.mesas[0]).toMatchObject({ mesaId: 'm2', x: 250, y: 300 });
    expect(numeros.m2).toBe(2);
    const nueva = plano.mesas[1];
    expect(nueva.mesaId.startsWith('nueva')).toBe(true);
    expect(numeros[nueva.mesaId]).toBe(8);
    expect(plano.zonas[0]).toMatchObject({ nombre: 'Terraza', x: 0, w: 500 });
    expect(plano.elementos[0]).toMatchObject({ tipo: 'barra', w: 400 });
  });
});
