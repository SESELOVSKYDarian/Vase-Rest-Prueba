import { aCentavos, type Centavos } from '@vase/domain';
import { apiFetch } from './http';

export type CondicionIva = 'consumidor_final' | 'responsable_inscripto' | 'monotributo' | 'exento';
export type TipoDocumento = 'DNI' | 'CUIT' | 'CUIL';
export type TipoFactura = 'A' | 'B' | 'C';

export interface EstadoFactura {
  estado: 'pendiente' | 'emitida' | 'rechazada';
  tipo: TipoFactura;
  nombre: string;
  /** Número real que el local obtuvo en ARCA; solo cuando ya está emitida. */
  numero: string | null;
  motivo: string;
}

/** Ticket del cliente: acredita el pago pero NO es una factura. */
export interface Ticket {
  local: string;
  razonSocial: string;
  cuit: string;
  condicionIvaLocal: string;
  domicilio: string;
  codigo: string;
  mesa: number | null;
  fecha: string;
  metodo: string;
  items: Array<{ nombre: string; cantidad: number; importe: Centavos }>;
  monto: Centavos;
  propina: Centavos;
  total: Centavos;
  ivaContenido: Centavos;
  leyenda: string;
  puedePedirFactura: boolean;
  condicionEmisor: string;
  factura: EstadoFactura | null;
}

export async function obtenerTicket(codigo: string): Promise<Ticket> {
  const t = await apiFetch<any>(`/public/pago/${encodeURIComponent(codigo)}/ticket`);
  return {
    ...t,
    items: t.items.map((i: any) => ({ ...i, importe: aCentavos(i.importe) })),
    monto: aCentavos(t.monto),
    propina: aCentavos(t.propina),
    total: aCentavos(t.total),
    ivaContenido: aCentavos(t.ivaContenido),
  };
}

export interface DatosFactura {
  condicionIva: CondicionIva;
  docTipo: TipoDocumento;
  docNumero: string;
  nombre: string;
  email: string;
  domicilio?: string;
}

export const pedirFactura = (codigo: string, datos: DatosFactura) =>
  apiFetch<{ ok: boolean; tipo: TipoFactura }>(`/public/pago/${encodeURIComponent(codigo)}/factura`, { method: 'POST', body: JSON.stringify(datos) });

/** Pedido de factura que espera que el local lo emita en ARCA. */
export interface FacturaPendiente {
  id: string;
  codigo: string;
  mesa: number | null;
  tipo: TipoFactura;
  condicionIva: CondicionIva;
  docTipo: TipoDocumento;
  docNumero: string;
  nombre: string;
  email: string;
  domicilio: string;
  importe: Centavos;
  importeNeto: Centavos;
  creadaEn: string;
}

export const marcarFacturaEmitida = (id: string, numero: string) =>
  apiFetch(`/avisos/facturas/${id}/emitida`, { method: 'POST', body: JSON.stringify({ numero }) });
export const rechazarPedidoFactura = (id: string, motivo: string) =>
  apiFetch(`/avisos/facturas/${id}/rechazar`, { method: 'POST', body: JSON.stringify({ motivo }) });
