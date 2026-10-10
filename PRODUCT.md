# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive — una sola base de código Expo (Android, iOS, web y escritorio Windows). Android es la plataforma principal.

## Stack

Expo universal (Expo Router) sobre el backend existente: Express + PostgreSQL 16 (`backend-reservas/`). El panel Next.js actual (`noctua/`) se migra por etapas y se retira al llegar a paridad.

## Users

Personal de restaurantes, bares y cafeterías en Argentina, con el local en marcha (servicio, manos ocupadas, luz variable, ruido):
- **Mozos** — celulares Android (algunos iPhone): toman pedidos, mueven y abren mesas, cobran en la mesa.
- **Cocina** — tablet Android fija (pantalla de comandas, siempre encendida).
- **Caja / encargado** — PC con Windows: cobro, facturación, caja, reportes, configuración.
- **Comensales** — su propio celular, escaneando un QR único por mesa.
- Pantallas de TV en el salón o la cocina que muestran pedidos listos.

## Product Purpose

Que el servicio de un local funcione de punta a punta desde una sola app: salón (plano de mesas), pedido, cocina, cobro, facturación electrónica ARCA y control de salida. Éxito = un mozo toma un pedido en menos de un minuto, la cocina lo ve al instante, la mesa paga sin esperar y la factura sale bien a la primera.

## Positioning

Sistema hecho para el ritmo del local argentino: facturación ARCA integrada, Mercado Pago/MODO, y un plano de mesas que se arma y se opera con el dedo. Hoy se usa desde un navegador; el objetivo es que se sienta una app nativa.

## Constraints

- Nada simulado: facturación ARCA y cobros Mercado Pago/MODO se hacen contra servicios reales; sin credenciales del dueño quedan bloqueados, nunca falseados.
- El salón no se puede caer si se corta internet (pedidos y comandas siguen funcionando; cobros online esperan).
- Español rioplatense; pesos argentinos.
- Todo lo visible tiene que funcionar de verdad, con datos reales, estados vacíos/errores/carga resueltos.

## Accessibility

Objetivos táctiles ≥ 44 pt, contraste AA en claro y oscuro, respeto de "reducir movimiento", textos escalables.

## Open decisions

- Estética: estilo Apple (más espacio, jerarquía clara, materiales sutiles). Dirección visual concreta se decide en la fase de diseño (ver `docs/PLAN-REDISENO-EXPO.md`).
