import test from "node:test";
import assert from "node:assert/strict";
import { cuitValido, formatearCuit, tipoSugerido, validarPedidoFactura } from "../src/services/factura.service.js";

test("CUIT: dígito verificador", () => {
  assert.equal(cuitValido("20-12345678-6"), true);
  assert.equal(cuitValido("20123456786"), true);
  assert.equal(cuitValido("20-12345678-5"), false);
  assert.equal(cuitValido("2012345678"), false);
  assert.equal(cuitValido(""), false);
  assert.equal(formatearCuit("20123456786"), "20-12345678-6");
});

test("tipo de factura según quién emite y quién recibe", () => {
  assert.equal(tipoSugerido("responsable_inscripto", "responsable_inscripto"), "A");
  assert.equal(tipoSugerido("consumidor_final", "responsable_inscripto"), "B");
  assert.equal(tipoSugerido("monotributo", "responsable_inscripto"), "B");
  assert.equal(tipoSugerido("responsable_inscripto", "monotributo"), "C");
});

test("pedido de factura: casos válidos e inválidos", () => {
  const ok = validarPedidoFactura({ condicionIva: "consumidor_final", docTipo: "DNI", docNumero: "30.123.456", nombre: "  Ana  Pérez ", email: "ANA@mail.com" });
  assert.equal(ok.datos.tipoComprobante, "B");
  assert.equal(ok.datos.docNumero, "30123456");
  assert.equal(ok.datos.nombre, "Ana Pérez");
  assert.equal(ok.datos.email, "ana@mail.com");

  const ri = validarPedidoFactura({ condicionIva: "responsable_inscripto", docTipo: "CUIT", docNumero: "20123456786", nombre: "Mi Empresa SRL", email: "a@b.co" });
  assert.equal(ri.datos.tipoComprobante, "A");
  assert.equal(ri.datos.docNumero, "20-12345678-6");

  assert.match(validarPedidoFactura({ condicionIva: "responsable_inscripto", docTipo: "DNI", docNumero: "30123456", nombre: "X Y Z", email: "a@b.co" }).error, /CUIT/);
  assert.match(validarPedidoFactura({ condicionIva: "monotributo", docTipo: "CUIT", docNumero: "20123456785", nombre: "Juan", email: "a@b.co" }).error, /CUIT/);
  assert.match(validarPedidoFactura({ condicionIva: "consumidor_final", docTipo: "DNI", docNumero: "30123456", nombre: "Ana", email: "no-es-email" }).error, /email/);
  assert.match(validarPedidoFactura({}).error, /IVA/);
});

import { armarTicket, ivaContenido } from "../src/services/factura.service.js";

test("IVA contenido en importe final", () => {
  assert.equal(ivaContenido(12100), 2100);
  assert.equal(ivaContenido(1210), 210);
});

test("ticket: agrupa unidades por plato y no es factura", () => {
  const cuenta = { unidades: [
    { clave: "a:1", itemId: "a", nombre: "Milanesa", importe: 100 },
    { clave: "a:2", itemId: "a", nombre: "Milanesa", importe: 100 },
    { clave: "b:1", itemId: "b", nombre: "Flan", importe: 50 },
  ] };
  const pago = { codigo: "ABCD-2345", metodo: "transferencia", monto: 250, propina: 25, creado_en: "2026-01-01", detalle: { unidades: ["a:1", "a:2", "b:1"] } };
  const t = armarTicket({ pago, cuenta, config: { nombreLocal: "Vase", fiscal: { condicionIva: "monotributo" } }, mesaNumero: 5 });
  assert.equal(t.items.length, 2);
  assert.deepEqual(t.items[0], { nombre: "Milanesa", cantidad: 2, importe: 200 });
  assert.equal(t.total, 275);
  assert.equal(t.condicionEmisor, "monotributo");
  assert.match(t.leyenda, /no válido como factura/);
  const partes = armarTicket({ pago: { ...pago, detalle: { modo: "partes", partes: 3, unidades: [] } }, cuenta, config: {}, mesaNumero: 5 });
  assert.match(partes.items[0].nombre, /1\/3/);
});
