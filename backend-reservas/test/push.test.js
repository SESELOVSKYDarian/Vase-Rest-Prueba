import test from "node:test";
import assert from "node:assert/strict";
import { armarMensajes, esTokenExpo, tokensMuertos } from "../src/services/push.service.js";

test("tokens de Expo válidos e inválidos", () => {
  assert.equal(esTokenExpo("ExponentPushToken[abc123_-]"), true);
  assert.equal(esTokenExpo("ExpoPushToken[xyz]"), true);
  assert.equal(esTokenExpo("fcm:APA91b..."), false);
  assert.equal(esTokenExpo(""), false);
  assert.equal(esTokenExpo(null), false);
});

test("mensaje con el canal del servicio y prioridad alta", () => {
  const [m] = armarMensajes(["ExpoPushToken[a]"], { titulo: "Mesa 5 · listo para servir", cuerpo: "x", data: { mesa: 5 } });
  assert.equal(m.to, "ExpoPushToken[a]");
  assert.equal(m.title, "Mesa 5 · listo para servir");
  assert.equal(m.priority, "high");
  assert.equal(m.channelId, "servicio");
  assert.deepEqual(m.data, { mesa: 5 });
});

test("solo se descartan los dispositivos que Expo dice que ya no existen", () => {
  const mensajes = armarMensajes(["ExpoPushToken[a]", "ExpoPushToken[b]", "ExpoPushToken[c]"], { titulo: "t", cuerpo: "c" });
  const tickets = [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }, { status: "error", details: { error: "MessageRateExceeded" } }];
  assert.deepEqual(tokensMuertos(mensajes, tickets), ["ExpoPushToken[b]"]);
});
