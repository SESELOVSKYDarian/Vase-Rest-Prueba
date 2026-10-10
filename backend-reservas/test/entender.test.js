import test from "node:test";
import assert from "node:assert/strict";
import { entenderFecha, entenderHora, entenderNo, entenderPersonas, entenderRetiro, entenderSi, fechaArgentina, fechaLegible, hhmm, sumarDias } from "../src/services/whatsapp/entender.js";

// Sábado 10/10/2026 a las 18:30 en Argentina (UTC-3).
const HOY = fechaArgentina(new Date("2026-10-10T21:30:00Z"));

test("fecha y hora de Argentina", () => {
  assert.deepEqual(HOY, { iso: "2026-10-10", dia: 6, minutos: 18 * 60 + 30 });
  assert.equal(fechaArgentina(new Date("2026-10-11T01:59:00Z")).iso, "2026-10-10"); // 22:59 en AR
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
});

test("fechas dichas de distintas formas", () => {
  assert.equal(entenderFecha("hoy", HOY), "2026-10-10");
  assert.equal(entenderFecha("para mañana a las 21", HOY), "2026-10-11");
  assert.equal(entenderFecha("pasado mañana", HOY), "2026-10-12");
  assert.equal(entenderFecha("el viernes", HOY), "2026-10-16");
  assert.equal(entenderFecha("sábado", HOY), "2026-10-10");
  assert.equal(entenderFecha("el domingo 11", HOY), "2026-10-11");
  assert.equal(entenderFecha("15/10", HOY), "2026-10-15");
  assert.equal(entenderFecha("2/10", HOY), "2027-10-02"); // ya pasó: el año que viene
  assert.equal(entenderFecha("15 de noviembre", HOY), "2026-11-15");
  assert.equal(entenderFecha("el 20", HOY), "2026-10-20");
  assert.equal(entenderFecha("el 5", HOY), "2026-11-05");
  assert.equal(entenderFecha("31/02", HOY), null);
  assert.equal(entenderFecha("a las 10 de la mañana", HOY), null);
  assert.equal(entenderFecha("mañana a las 10 de la mañana", HOY), "2026-10-11");
  assert.equal(entenderFecha("quiero reservar", HOY), null);
});

test("horas dichas de distintas formas", () => {
  assert.equal(entenderHora("a las 21:30"), "21:30");
  assert.equal(entenderHora("20.45"), "20:45");
  assert.equal(entenderHora("a las 9 de la noche"), "21:00");
  assert.equal(entenderHora("a las 9"), "21:00");
  assert.equal(entenderHora("a las 13"), "13:00");
  assert.equal(entenderHora("a las 12"), "12:00");
  assert.equal(entenderHora("a las 10 de la mañana"), "10:00");
  assert.equal(entenderHora("21hs"), "21:00");
  assert.equal(entenderHora("mediodía"), "12:00");
  assert.equal(entenderHora("mañana 20:00"), "20:00");
  assert.equal(entenderHora("9", { sola: true }), "21:00");
  assert.equal(entenderHora("21", { sola: true }), "21:00");
  assert.equal(entenderHora("9"), null);
  assert.equal(entenderHora("para 4 personas"), null);
});

test("cantidad de personas", () => {
  assert.equal(entenderPersonas("somos 4"), 4);
  assert.equal(entenderPersonas("para seis"), 6);
  assert.equal(entenderPersonas("mesa para 2 personas mañana"), 2);
  assert.equal(entenderPersonas("tres personas"), 3);
  assert.equal(entenderPersonas("quiero reservar mañana a las 21"), null);
  assert.equal(entenderPersonas("cinco", { sola: true }), 5);
  assert.equal(entenderPersonas("8", { sola: true }), 8);
  assert.equal(entenderPersonas("hola", { sola: true }), null);
});

test("sí y no", () => {
  assert.equal(entenderSi("Sí, dale"), true);
  assert.equal(entenderSi("dale"), true);
  assert.equal(entenderSi("no gracias"), false);
  assert.equal(entenderNo("No, mejor otro horario"), true);
  assert.equal(entenderNo("sí"), false);
});

test("hora de retiro", () => {
  const ahora = 18 * 60 + 30;
  assert.equal(entenderRetiro("en 30 minutos", ahora), ahora + 30);
  assert.equal(entenderRetiro("en una hora", ahora), ahora + 60);
  assert.equal(entenderRetiro("en media hora", ahora), ahora + 30);
  assert.equal(entenderRetiro("ahora", ahora), ahora);
  assert.equal(entenderRetiro("a las 21:15", ahora), 21 * 60 + 15);
  assert.equal(entenderRetiro("a las 1", ahora), 13 * 60 + 0 + 24 * 60); // 13:00 ya pasó: sería mañana
  assert.equal(entenderRetiro("blah", ahora), null);
  assert.equal(hhmm(21 * 60 + 5), "21:05");
  assert.equal(hhmm(24 * 60 + 15), "00:15");
});

test("fecha legible", () => {
  assert.equal(fechaLegible("2026-10-10", HOY), "hoy");
  assert.equal(fechaLegible("2026-10-11", HOY), "mañana");
  assert.equal(fechaLegible("2026-10-17", HOY), "sábado 17/10");
});
