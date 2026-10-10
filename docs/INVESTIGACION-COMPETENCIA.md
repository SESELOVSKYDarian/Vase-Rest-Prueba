# Competencia: qué hacen los mejores y qué le falta a Vase Rest

Fecha: octubre 2026. Fuentes al final. Aviso honesto: casi todo lo público sobre estos productos son páginas comerciales y comparativas escritas por competidores; sirven para saber **qué se espera** de un sistema, no para medir cuál es mejor.

## Con quién competimos

| Producto | Fuerte en | Débil en (según fuentes) |
| --- | --- | --- |
| **Toast** (EE. UU.) | Plano de mesas drag-and-drop por zonas, estados de mesa automáticos, handhelds para mozos, offline completo incluida la cocina, IA que **ejecuta** acciones (crear platos, marcar agotados) | Caro, lock-in de pagos; reservas/espera es un producto aparte |
| **Square for Restaurants** | Barato, fácil, gratis para empezar | Servicio a la mesa y cocina más flojos; sin costeo de recetas; su offline no cubre la cocina |
| **Lightspeed Restaurant** | Inventario y reportes profundos, multi-local | Cocina menos profunda; recargo si usás otro procesador de pagos |
| **TouchBistro** | Pensado para servicio a la mesa: cursos, plano, iPad | Solo iPad; costo |
| **SpotOn** | Handhelds, IA para editar la carta en masa | Cobertura mixta |
| **SevenRooms / OpenTable** | Reservas + plano + **perfil del cliente** (alergias, ocasiones, gasto), motor de asignación de mesas, tiempos de rotación | No son un POS; caros por cubierto (OpenTable) |
| **Eat App** | **Importa el plano desde una imagen o PDF y detecta mesas, formas y capacidad** | Solo reservas |
| **sunday** | QR en la mesa: dividir como quieras (partes, monto, por ítem), propina, pago y reseña en ~10 s | Su QR de pago no toma pedidos (es otro producto) |
| **Fudo** (Argentina) | Nube, mesas, cocina, stock, facturación, carta QR, QR dinámico de Mercado Pago en el ticket | Pensado para locales chicos |
| **Bistrosoft / Maxirest** (Argentina) | Gestión clásica, AFIP/ARCA, reportes | Sin carta QR ni cashless moderno (según comparativas) |
| **OlaClick** (Latam) | Carta QR y pedidos online gratis, WhatsApp | POS básico |

## Lo que todos los buenos tienen y nosotros todavía no

Prioridad P0 = sin esto no competimos; P1 = nos pone a la par de los mejores; P2 = nos diferencia.

**Salón y mesas**
- P0 · **Plano real del local**: zonas dibujadas, mesas con sus sillas, barra, paredes, puertas; editable con el dedo; estados en vivo. (Toast, TouchBistro, SevenRooms) → **hecho** (vista con zoom, editor con el dedo, estados en vivo).
- P0 · **Importar el plano desde una foto o un PDF** y que el sistema detecte mesas y zonas (Eat App). → **hecho** con IA (requiere `ANTHROPIC_API_KEY`).
- P1 · Secciones por mozo con rotación justa (cubiertos activos, tiempo desde la última mesa sentada).
- P1 · Tiempo de ocupación y alertas de mesa demorada; estado "sucia/para limpiar".
- P2 · Asignación inteligente de mesas para reservas y lista de espera.

**Carta**
- P0 · **Fotos de cada plato**, descripción, alérgenos y etiquetas (vegano, sin TACC, picante). → fotos **hechas**; faltan alérgenos y etiquetas.
- P0 · **Carta QR pública** (ver la carta desde el celular del cliente, sin app). → **hecho**, con QR imprimible por mesa.
- P0 · Modificadores (punto de cocción, sin cebolla, extras con precio) y combos.
- P0 · **Agotado al instante** en todos los canales (salón, QR, delivery).
- P1 · Horarios de carta (almuerzo/cena/happy hour) y precios por canal.
- P2 · Asistente de IA que edita la carta en masa por texto (SpotOn, Toast IQ). → **hecho** (órdenes con confirmación, texto y voz).

**Pedido y cocina**
- P0 · Cursos ("disparar" entrada/principal/postre) y comandas por estación (Toast, TouchBistro).
- P0 · Handheld del mozo con cobro en la mesa.
- P1 · Pedido desde el QR de la mesa con confirmación del mozo. → **hecho** (ver `docs/QR-Y-ASISTENTE.md`).
- P1 · Pantalla de cocina con tiempos por plato y alertas.

**Cobro**
- P0 · Dividir de todas las formas: partes, monto libre, **por ítem** (sunday). → **hecho** en el QR del cliente (no en la caja del personal todavía).
- P0 · Propina, múltiples medios en una cuenta, Mercado Pago QR dinámico (Fudo) y MODO.
- P0 · **Factura ARCA** A/B/C con CAE real.
- P1 · Pagar desde el QR de la mesa + control de salida (nuestra idea; sunday hace pago, nadie hace el control de salida). → **hecho** con transferencia confirmada por el local; Mercado Pago listo para activar con credenciales.
- P1 · Reseña después de pagar (sunday). → **hecho**.

**Clientes y reservas**
- P1 · Perfil del cliente: alergias, preferencias, ocasiones, gasto histórico (SevenRooms).
- P1 · Reservas con confirmación por WhatsApp y lista de espera.
- P2 · Fidelización (puntos, beneficios).

**Gestión**
- P0 · Inventario con descuento por receta y alertas de stock.
- P1 · Costeo de recetas y margen por plato; ingeniería de carta (Estrella / Caballo / Rompecabezas / Perro).
- P1 · Turnos del personal y costo laboral.
- P2 · Pronóstico de demanda (clima, feriados, eventos) para compras y personal.
- P2 · Asistente de IA que **actúa** (no solo responde): "marcá agotado el bife", "¿qué plato deja menos margen?" (Toast IQ). → **parcial**: actúa sobre disponibilidad y precios; falta responder preguntas de margen (necesita costeo de recetas).

**Plataforma**
- P0 · Funcionar sin internet en el salón (Toast lo hace incluida la cocina; Square no).
- P0 · Android, iOS, web y escritorio con una sola base (ya en marcha).
- P1 · Multi-local.

## Dónde podemos ser los mejores

1. **Hecho para Argentina de verdad**: ARCA, Mercado Pago y MODO integrados desde el día uno, IVA bien resuelto, pesos y redondeos correctos. Los grandes de afuera no facturan en ARCA; los locales tienen interfaces viejas.
2. **El plano más fácil del mercado**: subís una foto del plano y la IA arma las mesas y zonas; después lo ajustás con el dedo. Solo Eat App hace algo parecido y no es un POS.
3. **QR de mesa con control de salida**: pedir, pagar y salir validado. Nadie de los relevados ofrece la verificación en la salida.
4. **Diseño al nivel de una app de Apple** en Android, que es lo que usan los mozos en Argentina.
5. **IA que actúa** sobre la operación (carta, agotados, cierre de caja), no un chat decorativo.

## Ideas modernas (octubre 2026)

Qué está haciendo lo nuevo del mercado y cómo lo bajamos a Vase Rest. Casi todas las fuentes son de empresas que venden estas herramientas: sus porcentajes de mejora son promesas, no mediciones independientes.

| # | Idea | Quién lo hace / señal | Cómo sería en Vase Rest | Esfuerzo |
| --- | --- | --- | --- | --- |
| 1 | **Asistente que actúa**, no que solo responde | Toast IQ pasó de chat a "agentes" (marketing, turnos, precios); permite marcar agotados y cambiar la carta conversando | Barra "Pedile a Vase": *"marcá agotado el bife"*, *"subí 8 % las bebidas"*, *"¿qué plato dejó menos margen este mes?"*. Claude con herramientas sobre nuestra API, siempre con confirmación antes de cambiar algo | Medio |
| 2 | **Dictar el pedido** | La voz conversacional fue de lo más visto en el National Restaurant Show 2026 (sobre todo teléfono y drive-thru) | El mozo dice *"dos milas napo, una sin jamón, y una Malbec"* y la app arma los ítems con sus notas; él revisa y envía. Útil con una mano ocupada | Medio |
| 3 | **Pedir y pagar desde el QR de la mesa** con QR interoperable | sunday: pagar en la mesa, dividir por ítem, propina y reseña al pagar. En Argentina el QR interoperable (Transferencias 3.0, BCRA) acepta cualquier billetera | El QR que ya imprimimos pasa a: ver lo consumido, dividir por ítem, pagar con cualquier billetera, comprobante firmado para el **control de salida** (nadie lo tiene). Reseña: si es mala, va privada al local | Alto (necesita credenciales de pago) |
| 4 | **Reservas y pedidos por WhatsApp** | En Latinoamérica WhatsApp es la vidriera; ya hay bots con IA para Argentina y Brasil. Gran parte de las reservas se piden fuera de horario | Agente en WhatsApp (API oficial de Meta) que reserva viendo el plano real, confirma y recuerda; toma pedidos para llevar que caen directo en cocina | Alto |
| 5 | **Cocina con ritmo** | KDS con tiempos estimados por plato, "disparar" para que todo llegue junto y alerta de comanda trabada (CBS NorthStar / QSR Automations, 2026) | Tiempo de preparación aprendido del historial; la pantalla de cocina ordena y avisa cuándo arrancar cada plato; el mozo ve "listo en ~6 min" | Medio |
| 6 | **Pronóstico del turno** | Previsión de demanda con historial, clima y eventos | Cubiertos esperados por turno con clima, feriados largos y partidos importantes → cuánto comprar y cuánta gente poner | Medio |
| 7 | **Carta que vende sola** | Cartas QR con recomendaciones, traducción automática, alérgenos y precios por horario | Traducción para turistas, filtros sin TACC/vegano, "lo más pedido", sugerir acompañamiento o postre, happy hour automático | Bajo-medio |
| 8 | **Avisos en la pantalla bloqueada** | Live Activities (iPhone) y su equivalente en Android: Starbucks, Swiggy, Zomato siguen el pedido sin abrir la app | Para el mozo: "Mesa 5 · listo para servir". Para take-away: estado del pedido. Apple solo permite eventos que la persona inició, sin promociones | Medio (necesita build nativo) |
| 9 | **Plano con inteligencia** | Gestión de mesas con rotación y asignación (SevenRooms, OpenTable) | Mapa de calor de ventas y rotación por mesa, mesa demorada que late, reparto justo de mesas entre mozos | Bajo-medio |
| 10 | **Cliente reconocido** | Personalización en grandes cadenas: saludo por nombre, "lo de siempre" | Perfil por teléfono: alergias, ocasiones, gasto; tarjeta de fidelidad en Apple/Google Wallet | Medio |

**Estado:** hechas la **1** (parcial), **2**, **3** (transferencia; Mercado Pago listo para credenciales) y **7**. Quedan **4, 5, 6, 8, 9, 10**.

**Recomendación original:** primero el **3** (cierra el ciclo pedir → pagar → salir y es nuestra diferencia; el QR ya está impreso), el **2** y el **1** (IA que se nota en el día a día, con la misma integración de Claude que ya usamos para el plano) y el **7** (rápido y visible para el cliente). El **4** después, cuando el salón y el cobro estén sólidos.

Fuentes de esta sección: [NRN – nuevos agentes de Toast](https://www.nrn.com/restaurant-technology/toast-unveils-an-array-of-new-ai-agents-for-restaurants), [Toast IQ](https://pos.toasttab.com/blog/on-the-line/toast-iq), [Destination CRM – Toast IQ Grow](https://www.destinationcrm.com/Articles/CRM-News/CRM-Across-the-Wire/Toast-Debuts-Toast-IQ-Grow-174691.aspx), [Retail Systems – National Restaurant Show 2026](https://retailsystems.org/national-restauant-show-report/), [CloudKitchens – tendencias 2026](https://cloudkitchens.com/blog/restaurant-technology-trends), [NetSuite – tendencias 2026](https://www.netsuite.co.uk/portal/uk/resource/articles/business-strategy/restaurant-technology-trends.shtml), [Verdict Foodservice – CBS NorthStar](https://www.verdictfoodservice.com/newsletters/cbs-northstar-partners-with-qsr), [GORSPA – KDS](https://www.gorspa.org/commiq-beyond-the-display-how-a-kds-can-orchestrate-kitchen-efficiency/), [sunday – cuenta digital](https://sundayapp.com/?p=104510), [sunday – pago en la mesa](https://sundayapp.com/?p=40643), [BCRA – Transferencias 3.0](https://www.bcra.gob.ar/noticias/transferencia-con-qr/), [iProUP – récord de pagos QR 2026](https://www.iproup.com/finanzas/69308-pagos-qr-rompieron-record-cambiaron-como-usan-dinero-argentinos-junio-2026), [Product Hunt – WhatsApp en Latinoamérica](https://www.producthunt.com/posts/1212732), [Natural Bot](https://www.rankmyai.com/tools/c19ee3dd-f1a8-4fee-9e48-cadb0512d308/natural-bot), [Airship – Live Activities](https://www.airship.com/?p=29359), [Swiggy – seguimiento en pantalla bloqueada](https://www.thetechoutlook.com/new-release/software-apps/while-ordering-food-on-swiggy-we-came-across-this-new-feature-allowing-to-track-order-status-on-ios-lock-screen/), [fluuexqr – pedidos por QR 2026](https://fluuexqr.com/qr-ordering-restaurants-complete-guide-2026/).

## Fuentes

- Toast: [Toast Tables](https://pos.toasttab.com/products/toast-tables), [ayuda de Toast Tables](https://support.toasttab.com/en/article/Using-Toast-Tables-Waitlist), [comparación Toast vs Square](https://pos.toasttab.com/compare/toast-vs-square), [reseña de The Restaurant HQ](https://www.therestauranthq.com/restaurants/toast-pos-review/), [reseña de Expert Market](https://www.expertmarket.com/pos/toast-pos-system-review)
- Comparativas: [Owner.com](https://www.owner.com/blog/best-pos-system-for-restaurants), [UpMenu](https://www.upmenu.com/blog/best-restaurant-pos-systems/), [DineOpen](https://www.dineopen.com/blog/lightspeed-vs-touchbistro-vs-square-canada-2026), [RestroScout](https://restroscout.com/best-restaurant-pos-systems), [Restaurant Tools – IA en POS](https://restauranttools.ai/blog/best-restaurant-pos-with-ai-features-2026)
- Mesas y reservas: [SevenRooms – gestión de mesas](https://sevenrooms.com/platform/table-management/), [OpenTable – gestión de mesas](https://www.opentable.com/restaurant-solutions/products/table-management/), [Perfect Venue – SevenRooms vs OpenTable](https://www.perfectvenue.com/post/sevenrooms-vs-opentable)
- Plano desde imagen: [Eat App – Floor Plan Importer](https://restaurant.eatapp.co/knowledge/floor-plan-importer), [Reservit – editar plano](https://help.reservit.com/EN/how-to-edit-your-seating-plan-and-customize-your-floor-layout-reservit-restaurant-setup)
- Pago en la mesa: [sunday – dividir la cuenta](https://sundayapp.com/sunday-split-checks-any-way-they-want/), [sunday – pago con QR](https://sundayapp.com/pay-at-table-archive-2023/)
- Argentina: [Bistrosoft](https://bistrosoft.com/sistemas-gestion-gastronomica-restaurantes-argentina/), [Payper – comparativa](https://payperapp.io/preguntas/cual-es-el-mejor-software-para-bares-argentina), [OlaClick – plataformas PDV](https://olaclick.com/es/punto-de-venta/las-mejores-plataformas-de-sistema-pdv-para-restaurantes/), [Fudo – QR dinámico](https://intercom.help/fudoapp/es/articles/11732028-qr-dinamico), [Capterra – Fudo](https://www.capterra.es/software/1023879/fudo), [El Economista – OlaClick](https://eleconomista.com.ar/negocios/una-nueva-plataforma-latinoamericana-ayuda-restaurantes-entrar-mundo-digital-forma-gratuita-n53669)
- IA en restaurantes: [Tenzo](https://www.gotenzo.com/resources/insight/what-can-ai-do-for-restaurants-in-2026/), [Deelo](https://www.deelo.ai/blog/how-restaurants-use-ai-2026)
