# Plan de rediseño total — Vase Rest en Expo

Estado: **propuesta para aprobar** (no se escribió código de la app todavía).
Decisiones ya tomadas por vos: una sola app Expo universal · dispositivos: celulares Android de mozos, PC de caja Windows, iPhone/iPad, tablet Android en cocina, TVs en el salón · el salón no se cae si se corta internet · estilo Apple · todo funcional, nada de maquetas.

---

## 1. Qué vamos a construir

Una app que se instala en Android (principal), iOS y Windows, y también corre en el navegador, con la misma base de código:

| Superficie | Quién | Cómo se distribuye |
| --- | --- | --- |
| App Android (celular y tablet) | mozos, cocina | APK instalable directo y, cuando quieras, Google Play (EAS Build) |
| App iOS | mozos, dueño | TestFlight / App Store (requiere cuenta de Apple Developer) |
| App de escritorio Windows | caja, encargado | Instalador `.msi` (Expo web empaquetado con Tauri) |
| Web | cualquiera, **y el comensal con el QR de mesa** | URL pública |
| Modo TV | pantallas del salón/cocina | ruta `/tv` en el navegador de la tele; después build Android TV |

Backend: **se mantiene** (Express + PostgreSQL). Lo que cambia es todo lo que ve el usuario. El panel Next.js actual sigue funcionando hasta que la app nueva lo iguale; recién ahí se retira.

---

## 2. Lo que hacen los demás y lo que le falta a Vase Rest

Fuentes: guías y páginas comparativas de [Toast, Square y Lightspeed](https://www.upmenu.com/blog/toast-vs-lightspeed), [funciones de POS de mano 2026](https://www.flipdish.com/gb/resources/blog/handheld-pos-features-restaurants), [funciones de plataformas POS en la nube 2026](https://www.squirrelsystems.com/posts/technology/top-pos-features-for-2026-what-modern-operators-expect-from-a-cloud-first-restaurant-platform/) y, para Argentina, [Fudo según Capterra](https://www.capterra.es/software/1023879/fudo) y [una guía de software para restaurantes 2026](https://www.developargentina.com/blog/software-para-restaurantes-argentina-2026). Son fuentes comerciales: sirven para ver qué se espera de un sistema, no como medición.

Lo que se repite en los sistemas serios y hoy **no está** (o está a medias) en Vase Rest:

**Entran en este plan (prioridad alta)**
1. **Plano de mesas con estados en vivo** y que se pueda mover con el dedo (lo pediste).
2. **Dividir la cuenta** (por persona, por ítem, en partes iguales) y **propina**.
3. **Cobro con Mercado Pago/MODO por QR**, y múltiples medios de pago en una misma cuenta.
4. **Facturación ARCA real** (Factura A/B/C) con diagnóstico de conexión, comprobante en PDF y ticket.
5. **Pantalla de cocina por estación + turnos de salida** (entrada, principal, postre) para "disparar" cursos.
6. **Agotado (86)**: marcar un plato sin stock y que desaparezca al instante del pedido, QR y delivery.
7. **Modificadores y notas por plato** (sin cebolla, punto de cocción, extras con precio).
8. **Offline que no tira el salón** (sección 8).
9. **QR por mesa para el comensal** y **control de salida** (sección 7), tu idea; está dentro del plan.
10. **Modo TV** con pedidos listos.

**Fase posterior (valiosas, no urgentes)**: lista de espera, fidelización/puntos, propinas por mozo con cierre de turno, cierre de caja con arqueo, costeo de recetas y alertas de stock, reservas con confirmación por WhatsApp, impresión de comandas por estación, reportes por mozo/hora/plato.

---

## 3. Dirección de diseño: estilo Apple

Lo que significa "más Apple" traducido a reglas concretas (basado en las skills `apple-design`, `emil-design-eng`, `mobile-native`, `impeccable` y `ui-ux-pro-max`):

- **Espacio generoso.** Escala de 4 pt; márgenes de pantalla 20 pt en celular y 32–48 pt en tablet/escritorio; separación entre secciones de 32–40 pt. Menos cosas por pantalla, más aire.
- **Títulos grandes que se achican al scrollear** (large title → barra compacta) en cada pantalla principal.
- **Listas "inset grouped"**: bloques redondeados (radio 16–20) sobre fondo gris cálido muy suave, separadores finos de 0.5 pt, sin cajas anidadas.
- **Hojas (bottom sheets) en vez de pantallas y modales** para acciones: abrir mesa, dividir cuenta, cobrar. Con arrastre, detents (mitad/completa) y cierre con gesto.
- **Materiales con desenfoque** solo donde dan jerarquía (barra superior, barra inferior, hojas), nunca de decoración.
- **Tipografía**: SF Pro en iOS/macOS; en Android/Windows/web una sans neutra empaquetada con las mismas métricas (se elige en el prototipo, entre Inter y Geist). Los títulos grandes con peso 600–700 y tracking levemente negativo; números siempre tabulares en importes y mesas.
- **Un acento único** (la salvia de marca, ya configurable) más colores semánticos solo para estados de mesa y errores. Claro y oscuro desde el primer día.
- **Movimiento**: resortes (no curvas lineales) en gestos y hojas, ease-out fuerte en entradas, < 200 ms en lo frecuente, nada en lo que se usa cientos de veces por día (cambiar de pestaña, abrir el teclado). Todo en el hilo de UI con Reanimated. **Háptica** en acciones clave (abrir mesa, mandar a cocina, cobrar). `reduce motion` respetado.
- **Navegación**: celular → barra de pestañas inferior (Salón, Pedidos, Cocina, Caja, Más); tablet/escritorio → barra lateral colapsable con la misma estructura. La misma información, distinta forma, no dos apps.
- **Pulgar primero**: acciones principales abajo y al alcance; tocables de 44 pt mínimo; nada importante en las esquinas superiores del celular.

### Cómo se evita que quede "genérico"
Impeccable exige un `DESIGN.md` y verificación visual por tandas. Plan: (1) escribir `DESIGN.md` con tokens y reglas, (2) prototipar **tres pantallas clave** (Salón, Pedido, Cobro) en claro/oscuro y celular/tablet, (3) vos aprobás o corregís antes de migrar el resto. Esa aprobación es la compuerta de la fase 1.

---

## 4. Arquitectura técnica

```
vase-rest/
├─ apps/
│  ├─ app/            ← Expo universal (Expo Router): Android, iOS, web, TV
│  └─ desktop/        ← Tauri: empaqueta el export web como instalador Windows
├─ packages/
│  ├─ api/            ← cliente tipado del backend + hooks (TanStack Query)
│  ├─ domain/         ← tipos y reglas puras (estados de mesa, totales, división de cuenta, impuestos)
│  ├─ ui/             ← sistema de diseño (tokens, componentes, háptica, hojas)
│  └─ sync/           ← cola offline (outbox) y descubrimiento de servidor local
├─ backend-reservas/  ← se mantiene; se le agregan endpoints (QR de mesa, pagos, salida, tiempo real)
└─ noctua/            ← panel Next actual; vive hasta la paridad y se retira
```

**Stack propuesto** (a validar con el scaffold, versiones exactas se fijan al crear el proyecto):
- Expo SDK actual (55 según [la guía de actualización de Expo](https://expo.dev/blog/upgrading-to-sdk-55.md): arquitectura nueva obligatoria), Expo Router, Reanimated 4 + Gesture Handler, `expo-haptics`, `expo-blur`, `expo-secure-store`, `expo-sqlite` para el offline.
- Estilos: tokens propios + `StyleSheet` (sin librería de utilidades): evita la fricción conocida entre NativeWind y Reanimated 4 y deja el diseño Apple bajo control.
- Estado de servidor: TanStack Query. Estado de UI: Zustand (ya se usa hoy).
- Tiempo real: **SSE/WebSocket desde el backend** en lugar del polling cada 5–20 s de hoy (cocina, mesas, TV, pagos).
- Distribución: [EAS Build](https://docs.expo.dev/build-reference/apk/) con perfil `preview` para APK instalable y `production` para Play Store; escritorio con Tauri sobre `expo export --platform web` ([Expo documenta el export estático](https://docs.expo.dev/router/reference/static-rendering) pero **no** da una guía oficial de escritorio; el patrón Expo+Tauri existe pero lo validamos con un spike en la fase 0).

**Qué se reutiliza tal cual**: backend, base de datos, tipos, reglas de negocio de los servicios (`facturasService`, `mesaMergeService`, `comensalesService`, recetas y stock), lógica de roles (`roles.ts`) y el guard JWT.

**Qué se reescribe**: toda la UI (≈ 100 pantallas/componentes React DOM → React Native), el editor de plano (hoy Fabric.js sobre canvas, no existe en RN), el sistema de estilos.

---

## 5. Plano de mesas que se mueve (el centro de la app)

Hoy el plano es Fabric.js. En Expo se rehace con **vistas + Gesture Handler + Reanimated** (no Skia: son decenas de objetos, no miles, y evita cargar WebAssembly en web/desktop):

- **Modo servicio**: tocar una mesa abre su hoja (pedido, comensales, mozo, cobrar). Estados con color y badge de comensales; tiempo de ocupación visible.
- **Modo edición**: arrastrar mesas y sillas con el dedo, **pellizcar para zoom**, **dos dedos para rotar**, imán a grilla y a otras mesas, alineación guiada, duplicar, eliminar con deshacer. Formas: redonda, cuadrada, rectangular, barra; sillas se pegan a la mesa y se mueven con ella.
- **Unir y separar mesas** arrastrando una sobre otra.
- **Zonas** (salón, terraza, barra) como pestañas; fondo opcional (imagen del local).
- Posiciones guardadas en unidades lógicas (no píxeles), así el mismo plano se ve bien en celular, tablet y PC.
- Cambios de otro dispositivo (un mozo abre una mesa) se ven en vivo con animación de color, sin redibujar todo.
- Se migran los datos del plano actual (`salon_layouts`): el conversor lee el JSON de Fabric y lo lleva al formato nuevo; las copias duplicadas que arreglamos recientemente no vuelven.

**Criterio de "terminado"**: mover y rotar mesas en un Android de gama media a 60 fps, guardar, abrir desde otro dispositivo y ver el mismo plano; unir/separar mesas con un pedido abierto sin perder el pedido.

---

## 6. Caja y facturación completas

Flujo único desde la mesa o desde Caja:

1. **Cuenta**: ítems, descuentos/promociones, recargo, **propina** (porcentaje sugerido o monto libre).
2. **Dividir**: partes iguales, por comensal, por ítem. Cada parte genera su propio cobro y, si se pide, su propia factura.
3. **Cobrar**: efectivo (con vuelto), débito/crédito, transferencia, **QR Mercado Pago / MODO**, cuenta corriente; se pueden combinar medios en una misma cuenta.
4. **Facturar**: Factura A / B / C según el cliente (CUIT/DNI/consumidor final), **CAE real de ARCA**, PDF + QR fiscal. Ticket no fiscal para consumos internos (reutiliza el trabajo de la rama `seselovskydarian-plan-impresion-ticket-comandera`, que no se tocó).
5. **Comprobante** al comensal: PDF, enlace compartible por WhatsApp y **código/QR de comprobante** que se usa en la salida (sección 7).
6. **Caja**: apertura y cierre con arqueo, movimientos, diferencias; reportes por medio de pago y por mozo.

**Bloqueado por credenciales tuyas** (no se simula nada):
- **ARCA/AFIP**: CUIT, condición frente al IVA, punto de venta habilitado para web services y certificado digital. Se implementa contra homologación primero, luego producción.
- **Mercado Pago**: Access Token (modo prueba y producción) y webhook público. **MODO** requiere alta como comercio y su documentación; hasta tenerla queda reservado.

**Criterio de "terminado"**: con credenciales de homologación, emitir una factura, ver el CAE que informa ARCA (no uno generado local) y que el pago de Mercado Pago de prueba marque la cuenta como cobrada solo, por webhook.

---

## 7. QR por mesa y control de salida (tu idea, diseñada)

**Flujo**
1. Cada mesa tiene un **QR fijo e impreso** que apunta a `https://<tu-dominio>/m/<código-de-mesa>`.
2. El mozo **abre la mesa** en la app. Eso crea una *sesión de mesa* con un token firmado y vencimiento. **Sin sesión abierta el QR no deja hacer nada** (evita que alguien pida o vea cuentas desde afuera).
3. El comensal escanea y ve **lo que se pidió en su mesa**, en vivo, con el total. (Pedir desde el QR queda como opción posterior: lo que describiste es ver y pagar.)
4. Paga su parte o todo (Mercado Pago/MODO). El **servidor confirma el pago por webhook**, nunca por lo que diga el celular.
5. Se genera el **comprobante**: pantalla con estado "Pagado" + código corto + QR de un solo uso, ligado a esa sesión y a ese monto.
6. En la **salida**, la persona de control abre *Control de salida* en la app, **escanea o tipea el código** y el servidor responde: Pagado y vigente / Pago parcial / Ya usado / No encontrado. Al validarlo queda registrado quién lo controló y cuándo, y el comprobante no se puede reutilizar.
7. Al cobrar y cerrar la mesa, la sesión caduca y el QR de la mesa se vuelve a "disponible".

**Seguridad y casos borde diseñados desde el inicio**: límite de intentos, tokens de un solo uso para el comprobante, captura de pantalla compartida no sirve una vez usado, pagos parciales y propinas, mesa que se une a otra, pago hecho y luego el mozo agrega un ítem (el comprobante se invalida y muestra la diferencia), cuenta cobrada en efectivo por el mozo (el mozo marca "pagado" y se genera el mismo comprobante), conexión caída del comensal.

---

## 8. Offline: que el salón no se caiga

Pedido tuyo: seguir tomando pedidos y mandando a cocina sin internet.

- **Cada dispositivo** guarda sus cambios en una cola local (SQLite) y los envía cuando vuelve la conexión, con idempotencia (no se duplican pedidos al reintentar).
- **Para que el mozo y la cocina se vean entre sí sin internet** hace falta que el backend corra **en el local**: el `docker-compose` que ya existe se puede levantar en la PC de caja y los dispositivos lo encuentran por la red Wi-Fi interna (descubrimiento automático con IP configurable de respaldo). Con internet, ese servidor local sincroniza con la nube.
- **Qué queda en espera sin internet**: cobros Mercado Pago/MODO y emisión ARCA (se cobran como "pendiente de facturar" y se facturan al volver). Las pantallas lo dicen claro, con un indicador discreto de estado de conexión.

**Decisión que necesito de vos** (sección 11): ¿vas a tener una PC o mini-PC fija en el local para el servidor? Sin eso, "sin internet" solo cubre lo que cada dispositivo puede hacer solo.

---

## 9. Pantallas y roles (todo funcional)

Cada pantalla tiene: datos reales del backend, estados de carga/vacío/error, permisos por rol, y una prueba automática del recorrido principal.

| Rol | Pestañas principales |
| --- | --- |
| Mozo | Salón · Pedido · Mis mesas · Más |
| Cocina | Comandas (por estación) · Historial |
| Cajero | Caja · Cobros · Facturas · Cuentas corrientes |
| Encargado | todo lo anterior + Menú · Inventario · Reservas · Clientes · Equipo · Reportes |
| Admin | + Configuración (negocio, ARCA, pagos, plano, QR de mesas, TV, impresoras, tema) |

Se migran las pantallas existentes: Inicio, Mesas, Pedido, Cocina, Facturas, Historial, Delivery, Reservas, Menú (platos + promociones), Inventario, Clientes, Mozos, Analítica, Administración, Diseño (solo modo/acento), Soporte.

---

## 10. Fases, entregables y compuertas

| Fase | Entrega | Compuerta (se verifica antes de seguir) |
| --- | --- | --- |
| **0. Fundaciones** | Monorepo, app Expo que levanta en web/Android, login contra el backend real, cliente API tipado, CI con lint + tipos + pruebas, spike de Tauri en Windows | App abre, loguea y lista mesas reales en web y en un emulador Android |
| **1. Sistema de diseño Apple** | `DESIGN.md`, tokens, componentes (título grande, lista inset, hoja, barra de pestañas, botones, toasts, háptica), 3 pantallas prototipo en claro/oscuro, celular/tablet | **Aprobás el look** (compuerta tuya) |
| **2. Salón** | Plano movible completo, hoja de mesa, abrir/cerrar/unir/separar, tiempo real por SSE | Prueba en Android real a 60 fps; dos dispositivos sincronizados |
| **3. Pedido, cocina y TV** | Toma de pedido con modificadores y agotados, comandas por estación y cursos, KDS tablet, modo TV | Pedido de mozo aparece en cocina y TV en < 1 s |
| **4. Caja y facturación** | Cuenta, división, propina, medios de pago, caja con arqueo, factura ARCA (homologación), Mercado Pago QR (sandbox), comprobantes | Factura con CAE real de homologación; pago sandbox cobra solo |
| **5. QR de mesa + salida** | Sesión de mesa, página pública del comensal, pago, comprobante, Control de salida | Recorrido completo mesa→pago→salida con 2 celulares |
| **6. Resto del panel** | Menú, Inventario, Clientes, Reservas, Delivery, Analítica, Equipo, Administración, Soporte | Paridad con el panel Next (lista de chequeo por pantalla) |
| **7. Offline y impresión** | Cola local, servidor en el local, indicador de conexión, impresión de tickets/comandas | Cortar internet y completar un servicio de prueba |
| **8. Empaquetado y salida** | APK Android firmado, build iOS, instalador Windows, guía de instalación, retiro del panel Next | Instalación limpia en dispositivos reales |

**Cómo se trabaja**: una fase por vez, cada una verificada con capturas y pruebas, commit a la rama y resumen. Las capturas de pantalla de cada fase van a vos; la fase 1 no avanza sin tu OK. Skills por etapa: `impeccable` (shape/craft/polish/audit) y `apple-design` en diseño; `animate-expo` y `mobile-native` en gestos y plano; `break-ui` con datos extremos (nombres largos, 0 ítems, 200 ítems); `review-animations` antes de cerrar cada fase; `ui-ux-pro-max` y `web-design-guidelines` para revisión.

---

## 11. Lo que necesito de vos y límites honestos

**Necesito**
1. **Cuenta de Expo (EAS)** y un token, para generar el APK/IPA. Sin eso no hay instalables; el código sí se puede construir y probar en web y emulador.
2. **Credenciales ARCA** (CUIT, punto de venta, certificado) y **Mercado Pago** (Access Token de prueba y producción) cuando lleguemos a la fase 4. MODO: datos de alta cuando los tengas.
3. **Decidir el servidor del local** (PC/mini-PC fija sí/no) para el offline de la sección 8.
4. **Dominio público con HTTPS** para el QR de mesa y el webhook de pagos.
5. Cuentas de **Apple Developer** (iOS) y **Google Play** (si querés publicar en tienda); para solo instalar en tus equipos Android alcanza el APK.
6. Un **Android real y una impresora térmica** (si vas a imprimir) para las pruebas de las fases 2, 3 y 7.

**Límites que conviene que sepas**
- Esto es un proyecto de **varias semanas de trabajo**, no una sesión. Por eso está dividido en fases con entrega verificable; propongo arrancar por la 0 y la 1.
- Desde este entorno no puedo instalar la app en un teléfono ni probar impresoras/pagos reales; lo que sí hago es probar en web, emulador y pruebas automáticas, y dejarte los builds listos.
- El empaquetado de escritorio con Tauri y la impresión térmica Bluetooth desde Android son los puntos de mayor incertidumbre técnica; los dos tienen un spike previo para no apostar a ciegas.
- Datos de la investigación vienen de páginas comerciales; sirven de guía de funciones, no de medición de mercado.
