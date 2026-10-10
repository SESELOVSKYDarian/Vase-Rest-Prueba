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
- P2 · Asistente de IA que edita la carta en masa por texto (SpotOn, Toast IQ).

**Pedido y cocina**
- P0 · Cursos ("disparar" entrada/principal/postre) y comandas por estación (Toast, TouchBistro).
- P0 · Handheld del mozo con cobro en la mesa.
- P1 · Pedido desde el QR de la mesa con confirmación del mozo.
- P1 · Pantalla de cocina con tiempos por plato y alertas.

**Cobro**
- P0 · Dividir de todas las formas: partes, monto libre, **por ítem** (sunday).
- P0 · Propina, múltiples medios en una cuenta, Mercado Pago QR dinámico (Fudo) y MODO.
- P0 · **Factura ARCA** A/B/C con CAE real.
- P1 · Pagar desde el QR de la mesa + control de salida (nuestra idea; sunday hace pago, nadie hace el control de salida).
- P1 · Reseña después de pagar (sunday).

**Clientes y reservas**
- P1 · Perfil del cliente: alergias, preferencias, ocasiones, gasto histórico (SevenRooms).
- P1 · Reservas con confirmación por WhatsApp y lista de espera.
- P2 · Fidelización (puntos, beneficios).

**Gestión**
- P0 · Inventario con descuento por receta y alertas de stock.
- P1 · Costeo de recetas y margen por plato; ingeniería de carta (Estrella / Caballo / Rompecabezas / Perro).
- P1 · Turnos del personal y costo laboral.
- P2 · Pronóstico de demanda (clima, feriados, eventos) para compras y personal.
- P2 · Asistente de IA que **actúa** (no solo responde): "marcá agotado el bife", "¿qué plato deja menos margen?" (Toast IQ).

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

## Fuentes

- Toast: [Toast Tables](https://pos.toasttab.com/products/toast-tables), [ayuda de Toast Tables](https://support.toasttab.com/en/article/Using-Toast-Tables-Waitlist), [comparación Toast vs Square](https://pos.toasttab.com/compare/toast-vs-square), [reseña de The Restaurant HQ](https://www.therestauranthq.com/restaurants/toast-pos-review/), [reseña de Expert Market](https://www.expertmarket.com/pos/toast-pos-system-review)
- Comparativas: [Owner.com](https://www.owner.com/blog/best-pos-system-for-restaurants), [UpMenu](https://www.upmenu.com/blog/best-restaurant-pos-systems/), [DineOpen](https://www.dineopen.com/blog/lightspeed-vs-touchbistro-vs-square-canada-2026), [RestroScout](https://restroscout.com/best-restaurant-pos-systems), [Restaurant Tools – IA en POS](https://restauranttools.ai/blog/best-restaurant-pos-with-ai-features-2026)
- Mesas y reservas: [SevenRooms – gestión de mesas](https://sevenrooms.com/platform/table-management/), [OpenTable – gestión de mesas](https://www.opentable.com/restaurant-solutions/products/table-management/), [Perfect Venue – SevenRooms vs OpenTable](https://www.perfectvenue.com/post/sevenrooms-vs-opentable)
- Plano desde imagen: [Eat App – Floor Plan Importer](https://restaurant.eatapp.co/knowledge/floor-plan-importer), [Reservit – editar plano](https://help.reservit.com/EN/how-to-edit-your-seating-plan-and-customize-your-floor-layout-reservit-restaurant-setup)
- Pago en la mesa: [sunday – dividir la cuenta](https://sundayapp.com/sunday-split-checks-any-way-they-want/), [sunday – pago con QR](https://sundayapp.com/pay-at-table-archive-2023/)
- Argentina: [Bistrosoft](https://bistrosoft.com/sistemas-gestion-gastronomica-restaurantes-argentina/), [Payper – comparativa](https://payperapp.io/preguntas/cual-es-el-mejor-software-para-bares-argentina), [OlaClick – plataformas PDV](https://olaclick.com/es/punto-de-venta/las-mejores-plataformas-de-sistema-pdv-para-restaurantes/), [Fudo – QR dinámico](https://intercom.help/fudoapp/es/articles/11732028-qr-dinamico), [Capterra – Fudo](https://www.capterra.es/software/1023879/fudo), [El Economista – OlaClick](https://eleconomista.com.ar/negocios/una-nueva-plataforma-latinoamericana-ayuda-restaurantes-entrar-mundo-digital-forma-gratuita-n53669)
- IA en restaurantes: [Tenzo](https://www.gotenzo.com/resources/insight/what-can-ai-do-for-restaurants-in-2026/), [Deelo](https://www.deelo.ai/blog/how-restaurants-use-ai-2026)
