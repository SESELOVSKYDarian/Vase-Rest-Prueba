import test from "node:test";
import assert from "node:assert/strict";
import { responder, SESION_VACIA } from "../src/services/whatsapp/motor.js";
import { normalizarConfig } from "../src/services/cartaConfig.service.js";
import { problemaDeHorario } from "../src/services/reservas.service.js";
import { indice, productos } from "./fixture.js";

// Sábado 10/10/2026 18:30 en Argentina.
const AHORA = new Date("2026-10-10T21:30:00Z");
const config = normalizarConfig({ nombreLocal: "Vase Rest" });

function crearCtx({ libres = [{ numero: 12, capacidad: 4, zona: "Salón" }], alternativas = [], reservaFalla = null } = {}) {
  const llamadas = { reservas: [], pedidos: [], cancelaciones: 0 };
  const ctx = {
    config,
    ahora: AHORA,
    indice,
    linkCarta: "https://vase.example/carta",
    nombrePerfil: "Ana",
    problemaDeHorario: (r) => problemaDeHorario(r, config, AHORA),
    disponibilidad: async () => ({ libres, alternativas }),
    enlacePlano: async () => "https://vase.example/reservar?t=abc",
    reservar: async (datos) => {
      if (reservaFalla) throw Object.assign(new Error(reservaFalla), { status: 409 });
      llamadas.reservas.push(datos);
      return { mesa: libres[0], reserva: { id: "a1b2c3d4-0000" } };
    },
    precios: async (carrito) => {
      const items = carrito.map((l) => { const p = productos.find((x) => x.id === l.productoId); return { ...l, nombre: p.nombre, subtotal: p.precio * l.cantidad }; });
      return { items, total: items.reduce((s, i) => s + i.subtotal, 0) };
    },
    pedirLlevar: async (datos) => { llamadas.pedidos.push(datos); return { codigo: "A1B2", total: 1, omitidos: [] }; },
    cancelarReservas: async () => { llamadas.cancelaciones++; return 1; },
  };
  return { ctx, llamadas };
}

async function conversar(ctx, mensajes) {
  let sesion = SESION_VACIA;
  const respuestas = [];
  for (const m of mensajes) {
    const r = await responder(sesion, m, ctx);
    sesion = r.sesion;
    respuestas.push(r.respuestas.join("\n"));
  }
  return { sesion, respuestas };
}

test("saludo muestra el menú", async () => {
  const { ctx } = crearCtx();
  const { respuestas } = await conversar(ctx, ["Hola"]);
  assert.match(respuestas[0], /Soy el asistente de Vase Rest/);
  assert.match(respuestas[0], /Reservar una mesa/);
});

test("reserva completa con todo en un mensaje", async () => {
  const { ctx, llamadas } = crearCtx();
  const { respuestas, sesion } = await conversar(ctx, ["Quiero reservar para 4 mañana a las 21", "sí", "sí"]);
  assert.match(respuestas[0], /Tengo mesa/);
  assert.match(respuestas[0], /mesa 12/);
  assert.match(respuestas[0], /mañana a las 21:00/);
  assert.match(respuestas[0], /vase\.example\/reservar/);
  assert.match(respuestas[1], /A nombre de quién/);
  assert.match(respuestas[2], /Pedí tu reserva/);
  assert.deepEqual(llamadas.reservas[0], { fechaIso: "2026-10-11", hora: "21:00", personas: 4, nombre: "Ana" });
  assert.equal(sesion.estado, "inicio");
});

test("reserva pregunta lo que falta, de a un dato", async () => {
  const { ctx, llamadas } = crearCtx();
  const { respuestas } = await conversar(ctx, ["1", "el viernes", "a las 9", "somos cinco", "dale", "Marcos Díaz"]);
  assert.match(respuestas[0], /Para qué día/);
  assert.match(respuestas[1], /A qué hora/);
  assert.match(respuestas[2], /cuántas personas/);
  assert.match(respuestas[3], /Tengo mesa/);
  assert.equal(llamadas.reservas[0].fechaIso, "2026-10-16");
  assert.equal(llamadas.reservas[0].hora, "21:00");
  assert.equal(llamadas.reservas[0].nombre, "Marcos Díaz");
});

test("sin lugar ofrece otros horarios y vuelve a buscar", async () => {
  let libres = [];
  const { ctx } = crearCtx();
  ctx.disponibilidad = async (r) => (r.hora === "22:00" ? { libres: [{ numero: 7, capacidad: 4, zona: "Salón" }], alternativas: [] } : { libres, alternativas: ["20:00", "22:00"] });
  const { respuestas } = await conversar(ctx, ["mesa para 4 mañana a las 21", "mejor a las 22"]);
  assert.match(respuestas[0], /no me queda mesa/);
  assert.match(respuestas[0], /20:00, 22:00/);
  assert.match(respuestas[1], /mesa 7/);
  libres = [];
});

test("una hora fuera de horario se rechaza y se pregunta de nuevo", async () => {
  const { ctx } = crearCtx();
  const { respuestas, sesion } = await conversar(ctx, ["reservar mañana a las 3 de la mañana para 2"]);
  assert.match(respuestas[0], /entre las 12:00 y las 23:30/);
  assert.equal(sesion.estado, "res_hora");
});

test("más personas de las permitidas", async () => {
  const { ctx } = crearCtx();
  const { respuestas } = await conversar(ctx, ["reservar para 30 personas mañana a las 21"]);
  assert.match(respuestas[0], /más de 12 personas/);
});

test("rechazar la mesa permite cambiar el horario", async () => {
  const { ctx, llamadas } = crearCtx();
  const { respuestas } = await conversar(ctx, ["mesa para 2 mañana a las 21", "no", "a las 22", "sí", "Lu"]);
  assert.match(respuestas[1], /nuevo día, hora/);
  assert.match(respuestas[2], /Tengo mesa/);
  assert.equal(llamadas.reservas[0].hora, "22:00");
});

test("si la mesa se ocupó mientras tanto, avisa y busca de nuevo", async () => {
  const { ctx } = crearCtx({ reservaFalla: "Ya no queda mesa en ese horario." });
  const { respuestas } = await conversar(ctx, ["mesa para 2 mañana a las 21", "sí", "sí"]);
  assert.match(respuestas[2], /Ya no queda mesa/);
});

test("cancelar la reserva desde el chat", async () => {
  const { ctx, llamadas } = crearCtx();
  const { respuestas } = await conversar(ctx, ["cancelar reserva"]);
  assert.match(respuestas[0], /cancelé tu reserva/);
  assert.equal(llamadas.cancelaciones, 1);
});

test("pedido para llevar de punta a punta", async () => {
  const { ctx, llamadas } = crearCtx();
  const { respuestas, sesion } = await conversar(ctx, ["quiero pedir para llevar", "2 milanesas napolitanas y una ipa", "listo", "sí", "en 45 minutos", "sí"]);
  assert.match(respuestas[0], /armemos tu pedido/);
  assert.match(respuestas[1], /2 × Milanesa napolitana/);
  assert.match(respuestas[1], /1 × Cerveza artesanal IPA/);
  assert.match(respuestas[1], /Total: \$ 37\.000/);
  assert.match(respuestas[2], /A nombre de quién/);
  assert.match(respuestas[3], /lo retirás/);
  assert.match(respuestas[4], /Revisá tu pedido/);
  assert.match(respuestas[5], /Pedido recibido/);
  assert.match(respuestas[5], /#A1B2/);
  assert.equal(llamadas.pedidos.length, 1);
  assert.equal(llamadas.pedidos[0].nombre, "Ana");
  assert.equal(llamadas.pedidos[0].retiroMin, 18 * 60 + 30 + 45);
  assert.deepEqual(llamadas.pedidos[0].carrito.map((l) => [l.productoId, l.cantidad]), [["mila", 2], ["ipa", 1]]);
  assert.equal(sesion.estado, "inicio");
});

test("pedido directo en el primer mensaje, plato agotado y horario ajustado", async () => {
  const { ctx } = crearCtx();
  const { respuestas } = await conversar(ctx, ["Quiero 2 milanesas napolitanas y un flan para llevar", "listo", "Pedro", "ahora"]);
  assert.match(respuestas[0], /2 × Milanesa napolitana/);
  assert.match(respuestas[0], /Flan casero.* agotado/);
  assert.match(respuestas[3], /Lo más pronto es a las 19:00/);
});

test("el pedido no se envía hasta que confirma y 'no' deja seguir editando", async () => {
  const { ctx, llamadas } = crearCtx();
  const { respuestas, sesion } = await conversar(ctx, ["2", "una milanesa napolitana", "listo", "sí", "a las 21", "no"]);
  assert.equal(llamadas.pedidos.length, 0);
  assert.match(respuestas[5], /agregar/);
  assert.equal(sesion.estado, "llevar_items");
});

test("no entiende un plato que no existe y no rompe el carrito", async () => {
  const { ctx } = crearCtx();
  const { respuestas } = await conversar(ctx, ["2", "una hamburguesa vegana de quinoa"]);
  assert.match(respuestas[1], /No encontré/);
});

test("pedidos enormes se derivan al local", async () => {
  const { ctx } = crearCtx();
  const { respuestas } = await conversar(ctx, ["2", "50 milanesas napolitanas"]);
  assert.match(respuestas[1], /más de 30 unidades/);
});

test("menu y cancelar vuelven al principio", async () => {
  const { ctx } = crearCtx();
  const { respuestas, sesion } = await conversar(ctx, ["mesa para 2", "cancelar"]);
  assert.match(respuestas[1], /lo dejamos acá/);
  assert.equal(sesion.estado, "inicio");
  const r = await conversar(ctx, ["asdkjh"]);
  assert.match(r.respuestas[0], /No estoy seguro/);
});

test("en medio de una reserva puede pasar a pedir para llevar", async () => {
  const { ctx } = crearCtx();
  const { respuestas } = await conversar(ctx, ["mesa para 2 mañana a las 21", "mejor quiero pedir 2 milanesas napolitanas para llevar"]);
  assert.match(respuestas[1], /2 × Milanesa napolitana/);
});

test("delivery no está disponible", async () => {
  const { ctx } = crearCtx();
  const { respuestas } = await conversar(ctx, ["hacen delivery?"]);
  assert.match(respuestas[0], /no hacemos envíos/);
});

test("reservas apagadas desde los ajustes", async () => {
  const { ctx } = crearCtx();
  ctx.config = normalizarConfig({ reservas: { activas: false } });
  const { respuestas } = await conversar(ctx, ["quiero reservar"]);
  assert.match(respuestas[0], /no tomamos reservas/);
});

import crypto from "node:crypto";
import { firmaValida, mensajesDeWebhook, normalizarTelefono } from "../src/services/whatsapp/whatsapp.service.js";

test("firma de Meta: válida, alterada y sin secreto", () => {
  const cuerpo = Buffer.from(JSON.stringify({ entry: [] }));
  const firma = `sha256=${crypto.createHmac("sha256", "secreto").update(cuerpo).digest("hex")}`;
  assert.equal(firmaValida(cuerpo, firma, "secreto"), true);
  assert.equal(firmaValida(Buffer.from("otro"), firma, "secreto"), false);
  assert.equal(firmaValida(cuerpo, firma, "otro-secreto"), false);
  assert.equal(firmaValida(cuerpo, "", "secreto"), false);
  assert.equal(firmaValida(cuerpo, firma, ""), false);
});

test("mensajes del webhook de Meta: texto, botón y tipos que no se leen", () => {
  const cuerpo = {
    entry: [{ changes: [{ value: {
      contacts: [{ wa_id: "5491155550000", profile: { name: "Ana" } }],
      messages: [
        { id: "wamid.1", from: "5491155550000", type: "text", text: { body: "Hola" } },
        { id: "wamid.2", from: "5491155550000", type: "interactive", interactive: { button_reply: { title: "Sí" } } },
        { id: "wamid.3", from: "5491155550000", type: "image", image: {} },
      ],
    } }] }],
  };
  const m = mensajesDeWebhook(cuerpo);
  assert.deepEqual(m.map((x) => x.texto), ["Hola", "Sí", ""]);
  assert.equal(m[0].nombrePerfil, "Ana");
  assert.equal(m[0].telefono, "5491155550000");
  assert.equal(normalizarTelefono("+54 9 11 5555-0000"), "5491155550000");
  assert.deepEqual(mensajesDeWebhook({}), []);
});
