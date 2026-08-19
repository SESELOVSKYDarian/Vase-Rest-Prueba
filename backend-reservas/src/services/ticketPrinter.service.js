import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PRINTER_NAME = process.env.COMANDERA_PRINTER_NAME || "SAM4S Giant-100";
const TICKET_WIDTH = 42;
const CURRENCY = "ARS";

const ESC = "\x1B";
const GS = "\x1D";

const init = () => `${ESC}@`;
const alignLeft = () => `${ESC}a\x00`;
const alignCenter = () => `${ESC}a\x01`;
const boldOn = () => `${ESC}E\x01`;
const boldOff = () => `${ESC}E\x00`;
const cut = () => `${GS}V\x00`;

function asMoney(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function line(char = "-") {
  return `${char.repeat(TICKET_WIDTH)}\n`;
}

function pad(text, len) {
  const value = String(text ?? "");
  return value.length >= len ? value.slice(0, len) : `${value}${" ".repeat(len - value.length)}`;
}

function compactDate(value) {
  try {
    return new Date(value || Date.now()).toLocaleString("es-AR");
  } catch {
    return String(value || "");
  }
}

function toPrintableItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const cantidad = Number(item?.cantidad || 0);
      const precioUnitario = Number(item?.precioUnitario || 0);
      const subtotal = Number(item?.subtotal || cantidad * precioUnitario);
      const nombre = item?.producto?.nombre || "Producto";
      return { cantidad, precioUnitario, subtotal, nombre };
    })
    .filter((item) => item.cantidad > 0 && item.subtotal >= 0);
}

function buildInternalTicket(payload) {
  const { comercio, pedidoId, mesa, recibidoPor, motivo, observacion, total, items, creadoEn } = payload;
  const printableItems = toPrintableItems(items);

  let out = "";
  out += init();
  out += alignCenter();
  out += boldOn() + `${comercio || "NOCTUA POS"}\n` + boldOff();
  out += "TICKET INTERNO\n";
  out += "NO FISCAL - PRUEBA\n";
  out += line();
  out += alignLeft();
  out += `Fecha: ${compactDate(creadoEn)}\n`;
  out += `Pedido: ${pedidoId}\n`;
  out += `Mesa: ${mesa || "N/A"}\n`;
  out += `Recibido por: ${recibidoPor || "N/A"}\n`;
  out += `Motivo: ${motivo || "N/A"}\n`;
  if (observacion) out += `Obs: ${String(observacion).slice(0, 120)}\n`;
  out += line();
  out += "Cant Descripcion          P.Unit  Importe\n";
  out += line();

  for (const item of printableItems) {
    const cant = pad(item.cantidad, 4);
    const nombre = pad(item.nombre, 20);
    const unit = pad(asMoney(item.precioUnitario), 8);
    const imp = asMoney(item.subtotal).padStart(10, " ");
    out += `${cant}${nombre}${unit}${imp}\n`;
  }

  out += line();
  out += boldOn() + `TOTAL: ${asMoney(total)}\n` + boldOff();
  out += "Pago: Efectivo\n";
  out += line();
  out += alignCenter();
  out += "Comprobante no valido como factura\n\n\n";
  out += cut();
  return out;
}

async function sendRawTicketToWindowsPrinter(rawTicket) {
  const fileName = `ticket_no_fiscal_${randomUUID()}.txt`;
  const filePath = path.join(os.tmpdir(), fileName);
  await fs.writeFile(filePath, rawTicket, { encoding: "latin1" });

  try {
    const psScript =
      `$printer = "${PRINTER_NAME.replace(/"/g, '""')}"\n` +
      `$file = "${filePath.replace(/\\/g, "\\\\")}"\n` +
      'Start-Process -FilePath notepad.exe -ArgumentList @("/pt", $file, $printer) -WindowStyle Hidden -Wait\n';
    await execFileAsync("powershell.exe", ["-NoProfile", "-Command", psScript], {
      windowsHide: true,
      timeout: 15000,
    });
  } finally {
    await fs.unlink(filePath).catch(() => undefined);
  }
}

export async function imprimirTicketPagoInternoNoFiscal(payload) {
  const ticket = buildInternalTicket(payload);
  await sendRawTicketToWindowsPrinter(ticket);
}
