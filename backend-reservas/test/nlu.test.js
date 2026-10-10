import test from "node:test";
import assert from "node:assert/strict";
import { indice, productos } from "./fixture.js";
import { interpretarComando, interpretarPedido, recomendar } from "../src/services/ia/nlu.local.js";
import { leerImporte, plegar } from "../src/services/ia/texto.js";

const resumen = (r) => r.lineas.map((l) => `${l.cantidad}× ${l.productoId}${l.notas ? ` [${l.notas}]` : ""}`);

test("plegar mantiene el largo y saca tildes", () => {
  assert.equal(plegar("Milanesa Ñoquis ÁÉÍÓÚ"), "milanesa noquis aeiou");
  assert.equal(plegar("jamón").length, "jamón".length);
});

test("importes en formato argentino", () => {
  assert.equal(leerImporte("22.000"), 22000);
  assert.equal(leerImporte("poné el bife a 22000"), 22000);
  assert.equal(leerImporte("$ 8.500,50"), 8500.5);
  assert.equal(leerImporte("22 mil"), 22000);
  assert.equal(leerImporte("sin números"), null);
});

test("pedido dictado: el ejemplo del mozo", () => {
  const r = interpretarPedido("dos milas napo, una sin jamón y una malbec", indice);
  assert.deepEqual(resumen(r), ["1× mila", "1× mila [sin jamón]", "1× malbec"]);
  assert.deepEqual(r.noEntendido, []);
});

test("pedido dictado: cantidades, apodos y aclaraciones", () => {
  const r = interpretarPedido("tres empas, una birra bien fría y dos ravioles sin queso y sin crema", indice);
  assert.deepEqual(resumen(r), ["3× empanadas", "1× ipa [bien fría]", "2× ravioles [sin queso y sin crema]"]);
});

test("pedido dictado: lo que no está en la carta se avisa", () => {
  const r = interpretarPedido("una pizza muzzarella y un bife para llevar", indice);
  assert.deepEqual(resumen(r), ["1× bife [para llevar]"]);
  assert.equal(r.noEntendido.length, 1);
});

test("pedido dictado: plato agotado se marca", () => {
  const r = interpretarPedido("un flan casero", indice);
  assert.equal(r.lineas[0].agotado, true);
});

test("comando: agotado", () => {
  for (const frase of ["marcá agotado el bife", "se acabó el bife de chorizo", "no hay más bife"]) {
    const r = interpretarComando(frase, indice);
    assert.equal(r.acciones[0]?.tipo, "agotado", frase);
    assert.deepEqual(r.acciones[0].productos.map((p) => p.id), ["bife"], frase);
  }
});

test("comando: disponible de nuevo", () => {
  const r = interpretarComando("volvió el flan", indice);
  assert.equal(r.acciones[0].tipo, "disponible");
  assert.deepEqual(r.acciones[0].productos.map((p) => p.id), ["flan"]);
});

test("comando: subir un porcentaje a una categoría", () => {
  const r = interpretarComando("subí 8 % las bebidas", indice);
  const a = r.acciones[0];
  assert.equal(a.tipo, "precio_pct");
  assert.equal(a.pct, 8);
  assert.equal(a.alcance, "categoria");
  assert.deepEqual(a.productos.map((p) => p.id).sort(), ["agua", "ipa", "limonada", "malbec"]);
  assert.equal(a.productos.find((p) => p.id === "agua").precioNuevo, 2810); // 2600 × 1,08 = 2808 → $2.810
});

test("comando: bajar con descuento y toda la carta", () => {
  const r = interpretarComando("bajá 10% toda la carta", indice);
  assert.equal(r.acciones[0].pct, -10);
  assert.equal(r.acciones[0].alcance, "todo");
  assert.equal(r.acciones[0].productos.length, productos.length);
});

test("comando: precio fijo de un plato", () => {
  const r = interpretarComando("poné el bife a 23.000", indice);
  assert.equal(r.acciones[0].tipo, "precio_fijo");
  assert.equal(r.acciones[0].precio, 23000);
  assert.deepEqual(r.acciones[0].productos.map((p) => p.id), ["bife"]);
});

test("comando: consulta de agotados y orden incomprensible", () => {
  assert.deepEqual(interpretarComando("qué platos están agotados", indice).respuesta.productos.map((p) => p.id), ["flan"]);
  const r = interpretarComando("hacé magia", indice);
  assert.equal(r.acciones.length, 0);
  assert.equal(r.noEntendido.length, 1);
});

test("recomendar: sin TACC y liviano", () => {
  const r = recomendar("quiero algo liviano y sin tacc", indice);
  assert.equal(r.entendido, true);
  assert.ok(r.ids.includes("ensalada"));
  for (const id of r.ids) assert.ok(productos.find((p) => p.id === id).etiquetas.includes("sin_tacc"), id);
});

test("recomendar: vegano trae solo veganos y disponibles", () => {
  const r = recomendar("soy vegana", indice);
  assert.ok(r.ids.length > 0);
  for (const id of r.ids) assert.ok(productos.find((p) => p.id === id).etiquetas.includes("vegano"), id);
});

test("recomendar: algo dulce no ofrece lo agotado", () => {
  const r = recomendar("algo dulce", indice);
  assert.deepEqual(r.ids, ["brownie"]);
});

test("recomendar: no picante y sin cebolla excluyen", () => {
  const r = recomendar("quiero algo para compartir, nada picante", indice);
  assert.ok(!r.ids.includes("provoleta"));
  assert.ok(r.ids.includes("tabla") || r.ids.includes("empanadas"));
});

test("recomendar: presupuesto y bebida sin alcohol", () => {
  const r = recomendar("algo para tomar sin alcohol, hasta 3 mil", indice);
  assert.deepEqual(r.ids, ["agua"]);
});

test("recomendar: sin etiquetas cargadas lo dice en vez de inventar", () => {
  const sinEtiquetas = { ...indice, productos: productos.map((p) => ({ ...p, etiquetas: [] })), items: indice.items.map((i) => ({ ...i, producto: { ...i.producto, etiquetas: [] } })) };
  const r = recomendar("celíaco", sinEtiquetas);
  assert.equal(r.sinResultados, true);
  assert.deepEqual(r.faltanEtiquetas, ["sin_tacc"]);
});

test("recomendar: sin pistas devuelve platos de distintas categorías", () => {
  const r = recomendar("no sé qué pedir", indice);
  assert.equal(r.entendido, false);
  assert.ok(r.ids.length >= 3);
});

test("comando: dos órdenes en una frase", () => {
  const r = interpretarComando("subí 8% las bebidas y marcá agotado el bife", indice);
  assert.deepEqual(r.acciones.map((a) => a.tipo), ["precio_pct", "agotado"]);
  assert.equal(r.acciones[0].alcance, "categoria");
  assert.deepEqual(r.acciones[1].productos.map((p) => p.id), ["bife"]);
  assert.deepEqual(r.noEntendido, []);
});

test("comando: tres órdenes con comas", () => {
  const r = interpretarComando("se acabó el bife, bajá 10% los postres y poné el flan a 6500", indice);
  assert.deepEqual(r.acciones.map((a) => a.tipo), ["agotado", "precio_pct", "precio_fijo"]);
});
