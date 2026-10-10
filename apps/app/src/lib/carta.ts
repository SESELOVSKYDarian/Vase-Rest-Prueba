import { Platform } from 'react-native';
import * as Print from 'expo-print';
import QRCode from 'qrcode';

/** Dónde abren la carta los clientes: la dirección web donde está publicada la app. */
export function urlCartaPorDefecto(): string {
  const env = process.env.EXPO_PUBLIC_WEB_URL;
  if (env) return env.replace(/\/+$/, '');
  if (Platform.OS === 'web' && globalThis.location) return globalThis.location.origin;
  return '';
}

export function linkCarta(base: string, mesa?: number, servidor?: string): string {
  const url = new URL(`${base.replace(/\/+$/, '')}/carta`);
  if (mesa) url.searchParams.set('mesa', String(mesa));
  // Solo cuando el local usa un servidor propio distinto del que la web deduce sola.
  if (servidor) url.searchParams.set('s', servidor);
  return url.toString();
}

export const esUrlValida = (texto: string) => {
  try {
    const u = new URL(texto);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** Una hoja A4 con una tarjeta recortable por mesa: número grande, QR y la instrucción. */
export async function htmlQrs(mesas: Array<{ numero: number; link: string }>): Promise<string> {
  const tarjetas = await Promise.all(
    mesas.map(async (m) => {
      const svg = await QRCode.toString(m.link, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1C1C1E', light: '#FFFFFF' } });
      return `<div class="tarjeta"><div class="mesa">Mesa</div><div class="numero">${m.numero}</div><div class="qr">${svg}</div><div class="texto">Escaneá para ver la carta</div><div class="link">${escapar(m.link)}</div></div>`;
    }),
  );
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>QR de las mesas</title>
<style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, "Inter", "Segoe UI", Roboto, sans-serif; color: #1C1C1E; }
.grilla { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8mm; }
.tarjeta { border: 0.4mm dashed #C7C7CC; border-radius: 6mm; padding: 8mm 6mm; text-align: center; break-inside: avoid; }
.mesa { font-size: 11pt; letter-spacing: .08em; text-transform: uppercase; color: #5C5C63; }
.numero { font-size: 40pt; font-weight: 700; line-height: 1.1; margin-bottom: 4mm; }
.qr svg { width: 52mm; height: 52mm; }
.texto { margin-top: 4mm; font-size: 13pt; font-weight: 600; }
.link { margin-top: 1.5mm; font-size: 7pt; color: #8A8A90; word-break: break-all; }
</style></head><body><div class="grilla">${tarjetas.join('')}</div></body></html>`;
}

/** Imprime (o guarda como PDF) el HTML. En web abre una ventana aparte para no imprimir la app. */
export async function imprimir(html: string): Promise<void> {
  if (Platform.OS === 'web') {
    const ventana = globalThis.open?.('', '_blank');
    if (!ventana) throw new Error('El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes e intentá de nuevo.');
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => ventana.print(), 300);
    return;
  }
  await Print.printAsync({ html });
}
