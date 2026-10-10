import { aCentavos, type Centavos } from '@vase/domain';
import { apiFetch } from './http';

/** La mesa vista desde el celular del cliente: cuenta, división y pago. Todos los importes en centavos. */
export interface UnidadCuenta {
  clave: string;
  itemId: string;
  nombre: string;
  notas: string;
  importe: Centavos;
  cubierta: boolean;
}

export interface CuentaQr {
  pedidoId: string;
  subtotal: Centavos;
  impuestos: Centavos;
  total: Centavos;
  pagado: Centavos;
  reservado: Centavos;
  pendiente: Centavos;
  items: Array<{ id: string; nombre: string; cantidad: number; precioUnitario: Centavos; subtotal: Centavos; notas: string; estado: string }>;
  unidades: UnidadCuenta[];
}

export interface MesaQr {
  mesa: { numero: number; zona: string };
  cuenta: CuentaQr | null;
  pago: { transferencia: boolean; alias: string; titular: string; mensaje: string; mercadopago: boolean };
  propinas: number[];
  ivaIncluido: boolean;
  pedidosQr: boolean;
  solicitudesPendientes: number;
}

const c = (n: number) => aCentavos(Number(n));

export async function obtenerMesaQr(numero: number): Promise<MesaQr> {
  const r = await apiFetch<any>(`/public/mesa/${numero}`);
  const cu = r.cuenta;
  return {
    ...r,
    cuenta: cu
      ? {
          ...cu,
          subtotal: c(cu.subtotal), impuestos: c(cu.impuestos), total: c(cu.total), pagado: c(cu.pagado), reservado: c(cu.reservado), pendiente: c(cu.pendiente),
          items: cu.items.map((i: any) => ({ ...i, precioUnitario: c(i.precioUnitario), subtotal: c(i.subtotal) })),
          unidades: cu.unidades.map((u: any) => ({ ...u, importe: c(u.importe) })),
        }
      : null,
  };
}

export type TipoSolicitud = 'pedido' | 'mozo' | 'cuenta';

export const enviarSolicitud = (numero: number, cuerpo: { tipo: TipoSolicitud; items?: Array<{ productoId: string; cantidad: number; notas?: string }>; nota?: string }) =>
  apiFetch<{ id: string; mensaje: string }>(`/public/mesa/${numero}/solicitud`, { method: 'POST', body: JSON.stringify(cuerpo) });

export type ModoDivision = 'todo' | 'partes' | 'unidades' | 'monto';

export interface PagoIniciado {
  codigo: string;
  estado: 'pendiente' | 'pagado' | 'rechazado' | 'vencido';
  metodo: 'transferencia' | 'mercadopago';
  monto: Centavos;
  propina: Centavos;
  total: Centavos;
  transferencia?: { alias: string; titular: string; mensaje: string };
  link?: string | null;
}

const mapPago = (r: any): PagoIniciado => ({ ...r, monto: c(r.monto), propina: c(r.propina), total: c(r.total) });

export async function iniciarPago(numero: number, cuerpo: { modo: ModoDivision; partes?: number; unidades?: string[]; monto?: number; propina: number; metodo: 'transferencia' | 'mercadopago' }) {
  return mapPago(await apiFetch(`/public/mesa/${numero}/pago`, { method: 'POST', body: JSON.stringify(cuerpo) }));
}

export interface Comprobante extends PagoIniciado {
  mesa: number | null;
  creadoEn: string;
  pagadoEn: string | null;
  local: string;
  reseniaEnviada: boolean;
}

export async function obtenerComprobante(codigo: string): Promise<Comprobante> {
  return mapPago(await apiFetch(`/public/pago/${encodeURIComponent(codigo)}`)) as Comprobante;
}

export const cancelarPago = (codigo: string) => apiFetch(`/public/pago/${encodeURIComponent(codigo)}/cancelar`, { method: 'POST' });

export const enviarResena = (codigo: string, estrellas: number, comentario: string) =>
  apiFetch(`/public/pago/${encodeURIComponent(codigo)}/resena`, { method: 'POST', body: JSON.stringify({ estrellas, comentario }) });
