import { aCentavos, type Centavos } from '@vase/domain';
import { apiFetch } from './http';
import type { FacturaPendiente } from './factura';
import type { ReservaPendiente } from './reservas';
import type { Comprobante } from './qr';

/** Lo que el salón tiene que atender (pedidos y llamados del QR, transferencias) y el control de salida. */
export interface SolicitudMesa {
  id: string;
  tipo: 'pedido' | 'mozo' | 'cuenta';
  mesa: number;
  mesaId: string;
  nota: string;
  creadaEn: string;
  items: Array<{ productoId: string; nombre: string; cantidad: number; notas: string }>;
}

export interface PagoPendiente {
  id: string;
  codigo: string;
  metodo: string;
  mesa: number | null;
  monto: Centavos;
  propina: Centavos;
  total: Centavos;
  creadoEn: string;
}

/** Pedido para llevar (entró por WhatsApp): cocina lo ve como cualquier pedido; acá se entrega y se cobra. */
export interface PedidoLlevar {
  id: string;
  codigo: string;
  estado: string;
  total: Centavos;
  cliente: string;
  telefono: string;
  retiro: string | null;
  creadoEn: string;
  items: Array<{ nombre: string; cantidad: number; notas: string }>;
}

export interface Avisos { solicitudes: SolicitudMesa[]; pagos: PagoPendiente[]; facturas: FacturaPendiente[]; reservas: ReservaPendiente[]; llevar: PedidoLlevar[] }

export async function obtenerAvisos(): Promise<Avisos> {
  const r = await apiFetch<{ solicitudes: SolicitudMesa[]; pagos: Array<Omit<PagoPendiente, 'monto' | 'propina' | 'total'> & { monto: number; propina: number; total: number }>; facturas: Array<Omit<FacturaPendiente, 'importe' | 'importeNeto'> & { importe: number; importeNeto: number }>; reservas?: ReservaPendiente[]; llevar?: Array<Omit<PedidoLlevar, 'total'> & { total: number }> }>('/avisos');
  return { solicitudes: r.solicitudes, pagos: r.pagos.map((p) => ({ ...p, monto: aCentavos(p.monto), propina: aCentavos(p.propina), total: aCentavos(p.total) })), facturas: (r.facturas ?? []).map((f) => ({ ...f, importe: aCentavos(f.importe), importeNeto: aCentavos(f.importeNeto) })), reservas: r.reservas ?? [], llevar: (r.llevar ?? []).map((l) => ({ ...l, total: aCentavos(l.total) })) };
}

export const aceptarSolicitud = (id: string) => apiFetch<{ ok: boolean; agregados: string[]; omitidos: Array<{ productoId: string; motivo: string }> }>(`/avisos/solicitudes/${id}/aceptar`, { method: 'POST' });
export const rechazarSolicitud = (id: string) => apiFetch(`/avisos/solicitudes/${id}/rechazar`, { method: 'POST' });
export const confirmarPagoQr = (id: string) => apiFetch<{ ok: boolean; cerrado: boolean; codigo: string }>(`/avisos/pagos/${id}/confirmar`, { method: 'POST' });
export const rechazarPagoQr = (id: string) => apiFetch(`/avisos/pagos/${id}/rechazar`, { method: 'POST' });

export interface ResultadoSalida {
  valido: boolean;
  motivo?: 'no_existe' | 'pendiente' | 'rechazado' | 'vencido';
  repetido?: boolean;
  primeraVez?: string;
  verificadoPor?: string;
  comprobante?: Comprobante;
}

export async function verificarSalida(codigo: string): Promise<ResultadoSalida> {
  const r = await apiFetch<any>(`/avisos/salida/${encodeURIComponent(codigo.trim())}`);
  const k = r.comprobante;
  return { ...r, comprobante: k ? { ...k, monto: aCentavos(k.monto), propina: aCentavos(k.propina), total: aCentavos(k.total) } : undefined };
}

export async function comprobantesRecientes(): Promise<Array<Comprobante & { verificado: boolean }>> {
  const r = await apiFetch<{ comprobantes: any[] }>('/avisos/salida');
  return r.comprobantes.map((k) => ({ ...k, monto: aCentavos(k.monto), propina: aCentavos(k.propina), total: aCentavos(k.total) }));
}

export const entregarPedidoLlevar = (id: string, metodo: 'efectivo' | 'debito' | 'credito' | 'billetera_virtual') =>
  apiFetch(`/avisos/llevar/${id}/entregar`, { method: 'POST', body: JSON.stringify({ metodo }) });
export const rechazarPedidoLlevar = (id: string) => apiFetch(`/avisos/llevar/${id}/rechazar`, { method: 'POST' });
