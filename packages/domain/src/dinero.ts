/**
 * Todo el dinero se maneja en CENTAVOS enteros: nunca se suman decimales de punto
 * flotante en una cuenta (0.1 + 0.2 ≠ 0.3 es un bug fiscal esperando suceder).
 */
export type Centavos = number;

export const aCentavos = (pesos: number): Centavos => Math.round(pesos * 100);
export const aPesos = (centavos: Centavos): number => centavos / 100;

const formato = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const formatoEntero = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** $ 12.345,50 — con centavos solo cuando hacen falta si `compacto`. */
export function formatearARS(centavos: Centavos, compacto = false): string {
  if (compacto && centavos % 100 === 0) return formatoEntero.format(centavos / 100);
  return formato.format(centavos / 100);
}

/**
 * Reparte `total` en `partes` sin perder ni inventar centavos: las primeras
 * `total % partes` partes reciben 1 centavo más.
 */
export function repartirEquitativo(total: Centavos, partes: number): Centavos[] {
  if (!Number.isInteger(total) || total < 0) throw new RangeError('El total debe ser un entero de centavos ≥ 0');
  if (!Number.isInteger(partes) || partes < 1) throw new RangeError('Las partes deben ser un entero ≥ 1');
  const base = Math.floor(total / partes);
  const resto = total - base * partes;
  return Array.from({ length: partes }, (_, i) => base + (i < resto ? 1 : 0));
}
