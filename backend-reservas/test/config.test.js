import test from "node:test";
import assert from "node:assert/strict";
import { ahoraArgentina, happyHourVigente, normalizarConfig, precioVigente, totalesDe } from "../src/services/cartaConfig.service.js";

// Argentina es UTC-3 todo el año. 2026-10-12 es lunes.
const lunes = (hhmm) => new Date(`2026-10-12T${hhmm}:00-03:00`);
const conHappy = (hh) => normalizarConfig({ happyHour: { activo: true, dias: [1], desde: "18:00", hasta: "20:00", descuento: 20, ...hh } });

test("hora argentina, no la del servidor", () => {
  assert.deepEqual(ahoraArgentina(new Date("2026-10-12T21:30:00Z")), { dia: 1, minutos: 18 * 60 + 30 });
});

test("happy hour: dentro, fuera y día equivocado", () => {
  const c = conHappy({});
  assert.equal(happyHourVigente(c, lunes("18:00")), true);
  assert.equal(happyHourVigente(c, lunes("19:59")), true);
  assert.equal(happyHourVigente(c, lunes("20:00")), false);
  assert.equal(happyHourVigente(c, lunes("17:59")), false);
  assert.equal(happyHourVigente(c, new Date("2026-10-13T19:00:00-03:00")), false); // martes
  assert.equal(happyHourVigente(normalizarConfig({}), lunes("19:00")), false); // desactivado
});

test("happy hour que cruza la medianoche", () => {
  const c = conHappy({ desde: "22:00", hasta: "02:00" });
  assert.equal(happyHourVigente(c, lunes("23:30")), true);
  assert.equal(happyHourVigente(c, new Date("2026-10-13T01:00:00-03:00")), true); // martes de madrugada: sigue el del lunes
  assert.equal(happyHourVigente(c, new Date("2026-10-13T03:00:00-03:00")), false);
});

test("precio con descuento y por categoría", () => {
  const cat = "11111111-1111-1111-1111-111111111111";
  const c = conHappy({ categorias: [cat], descuento: 25 });
  assert.deepEqual(precioVigente({ precio: 4000, categoria_id: cat }, c, lunes("19:00")), { precio: 3000, lista: 4000, happy: true });
  assert.deepEqual(precioVigente({ precio: 4000, categoria_id: "otra" }, c, lunes("19:00")), { precio: 4000, lista: 4000, happy: false });
  assert.equal(precioVigente({ precio: 4000, categoria_id: cat }, c, lunes("21:00")).happy, false);
});

test("IVA: sumado o incluido", () => {
  assert.deepEqual(totalesDe(10000, normalizarConfig({ ivaIncluido: false })), { subtotal: 10000, impuestos: 2100, total: 12100 });
  const incluido = totalesDe(12100, normalizarConfig({ ivaIncluido: true }));
  assert.equal(incluido.total, 12100);
  assert.equal(incluido.impuestos, 2100);
});

test("la configuración inválida vuelve a valores seguros", () => {
  const c = normalizarConfig({ idiomas: ["fr", "en"], happyHour: { descuento: 500, desde: "25:99", dias: [9, 2] }, propinas: [5, 99, -1], pago: { alias: "x".repeat(100) } });
  assert.deepEqual(c.idiomas, ["en"]);
  assert.equal(c.happyHour.descuento, 90);
  assert.equal(c.happyHour.desde, "18:00");
  assert.deepEqual(c.happyHour.dias, [2]);
  assert.deepEqual(c.propinas, [5, 30, 0]);
  assert.equal(c.pago.alias.length, 40);
});
