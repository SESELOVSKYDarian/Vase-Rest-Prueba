# QR de la mesa, carta que vende sola y asistente

Cómo funciona, qué se necesita para activarlo y qué **no** se simula. Todo lo de esta página está probado de punta a punta en este repositorio, salvo lo que dice "sin probar".

## El circuito: pedir → pagar → salir

1. **Pedir.** El cliente escanea el QR de su mesa (`/carta?mesa=N`), arma su pedido y toca **Pedir**. Queda como *solicitud*: el mozo la ve en **Salón → Avisos**, la confirma y recién ahí entra a cocina (con el precio de ese momento). Si alguien manda pedidos de broma, el mozo los rechaza; hay límite de pedidos pendientes por mesa.
2. **Cuenta.** En la pestaña *Cuenta* ve lo consumido, el IVA y lo que falta. Puede pagar **todo**, **una parte** (entre N), **sus platos** (elige uno por uno) o **otro importe**. El servidor calcula cada importe y no deja pagar dos veces el mismo plato.
3. **Pagar.**
   - **Transferencia** (siempre disponible si cargaste el alias): el cliente ve el alias, el importe exacto y un código para poner en el concepto. Cuando ves la plata en tu cuenta, tocás **Llegó** en *Avisos* y el cliente recibe su comprobante. La confirmación es manual a propósito: no hay forma de saber desde acá que una transferencia llegó sin una integración bancaria.
   - **Mercado Pago**: se activa cargando `MP_ACCESS_TOKEN` (ver abajo). El pago se confirma solo cuando Mercado Pago avisa y el servidor lo consulta. **Sin probar contra Mercado Pago real**: necesita tus credenciales.
   - No hay QR de pago "interoperable" propio: ese QR lo emite un banco o proveedor de pagos al comercio; no se puede generar a mano de forma válida.
4. **Comprobante y salida.** Cada pago confirmado tiene un código (`ABCD-1234`) y un QR. Quien está en la puerta lo escanea con la cámara del celular: se abre **Salida** con **PAGADO / puede salir**. Si el mismo comprobante se muestra otra vez, avisa "ya se mostró" con la hora del primer control. Si el código no existe o el pago sigue pendiente, lo dice.
5. **Reseña.** Después de pagar puede dejar estrellas y un comentario; el encargado las ve en *Carta → Ajustes → Reseñas*.

Al quedar saldada la cuenta se cierra el pedido y se libera la mesa. Los pagos se registran en `pagos` y `movimientos_caja` como **ingreso no fiscal**.

> **No se emite factura fiscal.** El comprobante acredita el pago; la factura electrónica de ARCA sigue pendiente de las credenciales del local. El comprobante lo aclara al cliente.

## Carta que vende sola

- **Traducción** a inglés y portugués (se elige en *Ajustes*). Orden: traducciones ya guardadas → IA gratuita si hay clave → MyMemory (gratis, sin clave) → glosario propio de platos argentinos. Lo que traduce un servicio real se guarda; el glosario no.
- **Etiquetas**: sin TACC, vegano, vegetariano, sin lactosa, picante. Se cargan por plato (*Carta → plato → Etiquetas*) y el cliente filtra por ellas. **No hay lista de alérgenos**: el asistente lo avisa siempre y recomienda confirmar con el mozo.
- **Lo más pedido**: los 3 platos con más unidades en 30 días (mínimo 2 pedidos).
- **Va muy bien con**: lo que más se pidió en la misma mesa; si hay pocos datos, una bebida o postre según el tipo de plato.
- **Happy hour**: días, horario (puede cruzar la medianoche), % y categorías. Se calcula con hora de Argentina y **se aplica también al cobrar**.
- **IVA**: *Ajustes → Los precios incluyen IVA*. Apagado, se suma 21 % al cobrar y la carta lo avisa ("más IVA"). Encendido, el precio es final.

## Asistente

### Para el cliente — "¿Qué se te antoja?"
Texto o voz. Entiende gustos y restricciones ("algo liviano sin gluten, nada picante, hasta 10 mil") y recomienda platos de la carta real con el motivo. Puede leer la respuesta en voz alta. Nunca inventa platos y las restricciones (sin TACC, vegano…) se aplican **solo** a platos que tengan la etiqueta.

### Para el personal
- **Órdenes** (admin y encargado), en *Carta → Asistente*: "marcá agotado el bife", "subí 8 % las bebidas", "poné el flan a 6500", "volvió el flan", "qué está agotado". Admite varias en una frase. Siempre muestra el **antes y el después** y espera confirmación; los precios se recalculan en el servidor al aplicar.
- **Pedido dictado** (mozo), en *Pedido → Dictar*: "dos milas napo, una sin jamón y una malbec". Arma las líneas con sus aclaraciones, avisa lo que no está en la carta y deja revisar antes de sumar al pedido.

### Cómo entiende (sin claves y con IA gratuita opcional)
El **motor propio** (reglas + coincidencia aproximada con la carta real, 27 pruebas automáticas) funciona sin conexión y sin claves. Si cargás una clave gratuita, la IA solo ayuda en los casos difíciles y **siempre se valida contra la carta real**:

| Servicio | Variable | Nivel gratuito (según las fuentes; verificalo en tu cuenta) |
| --- | --- | --- |
| Google Gemini | `GEMINI_API_KEY` | Modelos Flash / Flash-Lite con cupo diario; los límites cambian seguido |
| Groq | `GROQ_API_KEY` | Llama 3.x con cupo por minuto y por día |
| Claude | `ANTHROPIC_API_KEY` | De pago |
| MyMemory (traducción) | `MYMEMORY_EMAIL` (opcional) | 5.000 caracteres/día sin email, 50.000 con email |

Las integraciones con Gemini, Groq y MyMemory están escritas pero **sin probar contra los servicios reales**: este entorno de desarrollo no tiene salida a esos sitios ni claves. El motor propio y el glosario sí están probados.

### Voz
Dictado con el reconocimiento del propio dispositivo (gratis, no pasa por nuestro servidor): navegador (Chrome, Edge, Safari) y, en la app, Android/iOS con `expo-speech-recognition`. Necesita compilar la app (no corre en Expo Go). Si el dispositivo no lo soporta, el botón del micrófono no aparece y se escribe.

## Variables de entorno

Ver `backend-reservas/.env.example`: `LLM_PROVIDER`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `MYMEMORY_EMAIL`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `PUBLIC_API_URL` (https, para el aviso de Mercado Pago) y `PUBLIC_WEB_URL`.

## Fuentes sobre los niveles gratuitos
- [Gemini API: límites del nivel gratuito (guía)](https://yingtu.ai/en/blog/google-gemini-api-free-tier)
- [Gemini 2.5 Flash gratis](https://pasqualepillitteri.it/en/news/6683/gemini-2-5-flash-free-1m-tokens)
- [Groq: precios y nivel gratuito](https://eesel.ai/blog/groq-pricing)
- [Whisper gratis: Groq, Deepgram, AssemblyAI](https://toolfreebie.com/?p=237)
- [MyMemory: límites de la API](https://lilting.ch/en/articles/mymemory-api)
