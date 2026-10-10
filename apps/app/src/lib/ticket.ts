import type { Ticket } from '@vase/api';
import { formatearARS } from '@vase/domain';

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const METODO: Record<string, string> = { transferencia: 'Transferencia', mercadopago: 'Mercado Pago' };
const CONDICION: Record<string, string> = { responsable_inscripto: 'IVA Responsable Inscripto', monotributo: 'Monotributo', exento: 'IVA Exento' };

/** Ticket de 80 mm (sirve también para 58 mm) para imprimir o guardar como PDF. No es una factura y lo dice. */
export function htmlTicket(t: Ticket): string {
  const fecha = new Date(t.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  const filas = t.items
    .map((i) => `<tr><td>${i.cantidad} × ${escapar(i.nombre)}</td><td class="der">${formatearARS(i.importe, true)}</td></tr>`)
    .join('');
  const datosLocal = [t.razonSocial, t.cuit ? `CUIT ${t.cuit}` : '', CONDICION[t.condicionIvaLocal] ?? '', t.domicilio].filter(Boolean).map(escapar).join('<br>');
  const factura = t.factura?.estado === 'emitida' ? `<p class="centro">Factura ${t.factura.tipo} N° ${escapar(t.factura.numero ?? '')}</p>` : '';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Ticket ${escapar(t.codigo)}</title>
<style>
@page { size: 80mm auto; margin: 4mm; }
* { box-sizing: border-box; }
body { margin: 0 auto; width: 72mm; font: 12px/1.35 "Courier New", ui-monospace, monospace; color: #000; }
h1 { font-size: 16px; text-align: center; margin: 0 0 2mm; }
.centro { text-align: center; margin: 1mm 0; }
.chico { font-size: 10px; }
hr { border: 0; border-top: 1px dashed #000; margin: 3mm 0; }
table { width: 100%; border-collapse: collapse; }
td { padding: 0.6mm 0; vertical-align: top; }
.der { text-align: right; white-space: nowrap; padding-left: 3mm; }
.total td { font-weight: 700; font-size: 14px; padding-top: 1.5mm; }
</style></head><body>
<h1>${escapar(t.local)}</h1>
<p class="centro chico">${datosLocal}</p>
<hr>
<p class="centro">${t.mesa ? `Mesa ${t.mesa} · ` : ''}${fecha}<br>Comprobante ${escapar(t.codigo)}</p>
<hr>
<table>${filas}</table>
<hr>
<table>
<tr><td>Subtotal</td><td class="der">${formatearARS(t.monto, true)}</td></tr>
${t.propina > 0 ? `<tr><td>Propina</td><td class="der">${formatearARS(t.propina, true)}</td></tr>` : ''}
<tr class="total"><td>TOTAL</td><td class="der">${formatearARS(t.total, true)}</td></tr>
<tr><td class="chico">Pagó con ${escapar(METODO[t.metodo] ?? t.metodo)}</td><td></td></tr>
</table>
<hr>
<p class="chico">Régimen de transparencia fiscal (Ley 27.743)<br>IVA contenido: ${formatearARS(t.ivaContenido, true)}</p>
${factura}
<p class="centro chico"><b>${escapar(t.leyenda)}</b></p>
</body></html>`;
}
