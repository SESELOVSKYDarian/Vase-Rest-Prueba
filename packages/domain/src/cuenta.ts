import { repartirEquitativo, type Centavos } from './dinero';

export interface ItemCuenta {
  id: string;
  nombre: string;
  cantidad: number;
  /** Precio unitario en centavos. */
  precioUnitario: Centavos;
  /** Comensal al que se asignó (opcional, para dividir por persona). */
  comensal?: number;
}

export interface Cuenta {
  subtotal: Centavos;
  descuento: Centavos;
  /** Impuestos que el servidor suma sobre el consumo (hoy IVA 21 %). */
  impuestos: Centavos;
  propina: Centavos;
  total: Centavos;
}

export type Propina = { tipo: 'porcentaje'; valor: number } | { tipo: 'monto'; valor: Centavos } | { tipo: 'ninguna' };

export const subtotalItem = (item: ItemCuenta): Centavos => item.cantidad * item.precioUnitario;

export function calcularCuenta(
  items: readonly ItemCuenta[],
  opciones: { descuentoPorcentaje?: number; impuestos?: Centavos; propina?: Propina } = {},
): Cuenta {
  const subtotal = items.reduce((suma, item) => suma + subtotalItem(item), 0);
  const descuento = Math.round((subtotal * (opciones.descuentoPorcentaje ?? 0)) / 100);
  const impuestos = opciones.impuestos ?? 0;
  // La propina se calcula sobre lo que realmente se consume (con impuestos), no sobre el neto.
  const base = subtotal - descuento + impuestos;
  const propinaConfig = opciones.propina ?? { tipo: 'ninguna' as const };
  const propina =
    propinaConfig.tipo === 'porcentaje' ? Math.round((base * propinaConfig.valor) / 100)
    : propinaConfig.tipo === 'monto' ? propinaConfig.valor
    : 0;
  return { subtotal, descuento, impuestos, propina, total: base + propina };
}

export interface ParteCuenta {
  indice: number;
  total: Centavos;
  items: ItemCuenta[];
}

/** Dividir en partes iguales: el total de las partes siempre suma exactamente el total. */
export function dividirEnPartesIguales(total: Centavos, partes: number): ParteCuenta[] {
  return repartirEquitativo(total, partes).map((monto, indice) => ({ indice, total: monto, items: [] }));
}

/** Dividir por comensal: cada parte lleva sus ítems; lo sin asignar se reparte parejo. */
export function dividirPorComensal(items: readonly ItemCuenta[], comensales: number): ParteCuenta[] {
  if (comensales < 1) throw new RangeError('Debe haber al menos un comensal');
  const partes: ParteCuenta[] = Array.from({ length: comensales }, (_, indice) => ({ indice, total: 0, items: [] }));
  let sinAsignar = 0;
  for (const item of items) {
    const destino = item.comensal !== undefined ? partes[item.comensal] : undefined;
    if (destino) {
      destino.items.push(item);
      destino.total += subtotalItem(item);
    } else {
      sinAsignar += subtotalItem(item);
    }
  }
  if (sinAsignar > 0) {
    repartirEquitativo(sinAsignar, comensales).forEach((monto, i) => { partes[i].total += monto; });
  }
  return partes;
}
