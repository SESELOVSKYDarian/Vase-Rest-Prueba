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

## Ticket y factura

- Al confirmarse el pago, el comprobante del cliente tiene **Imprimir ticket** (80 mm, sirve para 58): platos cubiertos por ese pago, propina, total y el **IVA contenido** (importe × 21/121). Dice "no válido como factura". Los datos del local (razón social, CUIT, domicilio, condición frente al IVA) se cargan en Carta → Ajustes → *Datos fiscales del local*.
- **Pedir factura**: el cliente elige condición frente al IVA, documento (DNI/CUIT/CUIL con dígito verificador), nombre y email. El servidor decide el tipo: emisor Monotributo → C; emisor Responsable Inscripto → A para Resp. Inscripto y B para el resto.
- El pedido queda en **Avisos → Facturas**. El local copia los datos, emite en ARCA con sus propias credenciales y anota el número real (`0001-00000123`). El cliente ve el estado en su comprobante. **Este sistema no genera CAE ni números de factura**: sin credenciales de ARCA no se inventa nada.

## Plano con inteligencia

- **Mesa demorada**: el pedido guarda desde cuándo está en su estado. Plato listo sin servir (3 / 6 min), pedido sin tomar (5 / 10), en preparación (20 / 35), cuenta pedida (5 / 10), sentados sin pedido (8 / 15), estadía larga (100 / 150). Atención late lento en ámbar, urgente rápido en rojo; con "reducir movimiento" queda un anillo fijo. Chip **Demoradas** para filtrar y el motivo en la hoja de la mesa.
- **Mapa de calor** (admin, encargado, cajero): ventas, rotación (veces por día) y permanencia por mesa, últimos 30 días, sobre cuentas cerradas.
- **Reparto justo**: lista de mozos con mesas y comensales abiertos y mesas recibidas en el turno (8 h). Sugiere a quien menos trabajo tiene; asignar es un toque desde la mesa. Insignia con iniciales en el plano cuando hay más de un mozo. Al liberarse la mesa, se libera el mozo.

## Avisos en la pantalla bloqueada

"Mesa 5 · listo para servir" llega al mozo que atiende esa mesa (si no hay, a todos los mozos); también: mesa que pide desde el QR, transferencia por confirmar, pedido de factura. Un vigilante en el servidor mira la base cada 8 s y avisa **una sola vez** por evento.

Para que lleguen de verdad hace falta:

1. **La app instalada** (no Expo Go, no la web): `eas build` de Android/iOS.
2. Vincular el proyecto: `npx eas init` agrega `extra.eas.projectId` en `app.json`.
3. **Android**: credenciales de FCM (`eas credentials`). **iPhone**: cuenta de Apple Developer (APNs).
4. Con eso, al iniciar sesión la app pide permiso y registra el celular. Sin proyecto o sin permiso todo sigue funcionando, solo sin avisos del sistema.

No incluye Live Activities de iOS (la tarjeta viva en pantalla bloqueada tipo Starbucks): requieren código nativo propio de ActivityKit. Los clientes que usan la carta desde la web no reciben avisos; eso necesitaría Web Push o una app propia.

## WhatsApp: reservas y pedidos para llevar

El asistente conversa por WhatsApp (Cloud API de Meta) con estas reglas:

- **Reservar viendo el plano real.** "Mesa para 4 mañana a las 21" → el asistente entiende día, hora y personas (entiende "el sábado", "a las 9 de la noche", "somos cuatro"), busca mesas libres con la disponibilidad real (capacidad, reservas que se pisan, mesas ocupadas ahora) y propone la más justa. También manda un enlace corto al **plano del local** con las mesas libres para ese horario: la persona toca la que quiere. Si no hay lugar ofrece horarios cercanos. La reserva queda **pendiente** hasta que el local la confirma en **Avisos**, y la persona se entera por el mismo chat. "cancelar reserva" la cancela.
- **Pedidos para llevar directo a cocina.** "Quiero 2 milanesas napolitanas y una IPA para llevar" → arma el pedido con el mismo motor que entiende pedidos dictados (agotados, variantes), pide nombre y hora de retiro (respeta una demora mínima), muestra el total y, al confirmar, crea un pedido **para llevar** en estado pendiente: cocina lo ve como cualquier pedido (zona *PARA LLEVAR*). Cuando cocina lo marca listo, el cliente recibe el aviso por el chat. En **Avisos → Para llevar** se entrega y se cobra (efectivo o transferencia, queda en caja). Se paga al retirar.
- Límites: máximo de unidades por pedido, máximo 3 pedidos en curso por teléfono, 60 mensajes por hora, reservas hasta 90 días y dentro del horario que se define en Ajustes. No hace envíos a domicilio.
- Se ajusta en **Carta → Ajustes** (reservas: duración de la mesa, horario, máximo de personas; para llevar: demora mínima).

Para conectarlo de verdad hace falta una cuenta de **WhatsApp Business Platform** (Meta for Developers): número, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET` (firma de los avisos) y `WHATSAPP_VERIFY_TOKEN`. Configurar el webhook de la app apuntando a `https://TU-SERVIDOR/api/whatsapp/webhook`. Sin eso, **probalo con el simulador**: `POST /api/whatsapp/simular {"telefono":"5491100000000","texto":"hola"}` devuelve lo que se habría contestado. Notas de Meta: solo se puede escribir libremente dentro de las 24 h desde el último mensaje de la persona; fuera de esa ventana hacen falta plantillas aprobadas (no incluidas). Hoy solo se leen mensajes de texto y respuestas de botones.

## Variables de entorno

Ver `backend-reservas/.env.example`: `LLM_PROVIDER`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `MYMEMORY_EMAIL`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `PUBLIC_API_URL` (https, para el aviso de Mercado Pago) y `PUBLIC_WEB_URL`.

## Fuentes sobre los niveles gratuitos
- [Gemini API: límites del nivel gratuito (guía)](https://yingtu.ai/en/blog/google-gemini-api-free-tier)
- [Gemini 2.5 Flash gratis](https://pasqualepillitteri.it/en/news/6683/gemini-2-5-flash-free-1m-tokens)
- [Groq: precios y nivel gratuito](https://eesel.ai/blog/groq-pricing)
- [Whisper gratis: Groq, Deepgram, AssemblyAI](https://toolfreebie.com/?p=237)
- [MyMemory: límites de la API](https://lilting.ch/en/articles/mymemory-api)
