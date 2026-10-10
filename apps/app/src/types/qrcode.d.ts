// Tipos mínimos de `qrcode` (solo lo que usa la app: generar el SVG como texto).
declare module 'qrcode' {
  interface OpcionesSvg {
    type: 'svg';
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    color?: { dark?: string; light?: string };
  }
  export function toString(texto: string, opciones: OpcionesSvg): Promise<string>;
  const QRCode: { toString: typeof toString };
  export default QRCode;
}
