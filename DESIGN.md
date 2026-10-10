# Design — Vase Rest "Servicio"

Sistema visual de la app Expo (Android, iOS, web, escritorio). Estilo Apple adaptado al servicio de un local: mucho aire, jerarquía por tamaño y peso (no por cajas), un solo color de acción, estados siempre con texto, movimiento físico y corto. Fuente de verdad en código: `packages/ui/src/tokens.ts`.

Decisión deliberada: se usa el mismo lenguaje Apple en todas las plataformas (pedido explícito del dueño). En Android se respetan igual las garantías del sistema: botón/gesto Atrás, objetivos ≥ 48 dp, insets de borde a borde y escala de fuente del sistema.

## Color

Un único color de acción (verde de marca). Neutros ligeramente cálidos. Claro y oscuro de primera clase (sigue al sistema; se puede forzar en Ajustes).

| Rol | Claro | Oscuro |
| --- | --- | --- |
| `bg` fondo de pantalla | `#F2F2F7` | `#0C0C0E` |
| `surface` listas, tarjetas | `#FFFFFF` | `#1C1C1E` |
| `surface2` hojas, popovers | `#FFFFFF` | `#2C2C2E` |
| `label` texto | `#1C1C1E` | `#F5F5F7` |
| `labelSecondary` | `#5C5C63` | `#A6A6AD` |
| `labelTertiary` solo decorativo | `#8A8A90` | `#6E6E75` |
| `tint` acción | `#177A4E` | `#4CC38A` |
| `tintSoft` fondo tonal | `rgba(23,122,78,.12)` | `rgba(76,195,138,.18)` |
| `danger` | `#C8261D` | `#FF6B61` |
| `separator` | `rgba(60,60,67,.16)` | `rgba(235,235,245,.14)` |

Estados de mesa (color + etiqueta + contexto, nunca solo color): libre `#2E9B63`, ocupada `#D0503C`, esperando pedido `#3F78C6`, pedido listo `#D77A2E`, esperando pago `#B58A1F`, para cobrar `#8A5FC8`, problema `#C2406F` (variantes más claras en oscuro).

Color strategy: Restrained — neutros + un acento; el color de estado solo vive en bordes, puntos y píldoras de mesa.

## Tipografía

SF Pro en iOS (fuente del sistema); Inter con pesos 400/500/600/700 en Android, web y escritorio (en web se prefiere SF cuando el sistema la tiene). Escala de Apple: Large Title 34/41 700 · Title 1 28/34 · Title 2 22/28 · Title 3 20/25 · Headline 17/22 600 · Body 17/22 · Callout 16/21 · Subhead 15/20 · Footnote 13/18 · Caption 12/16. Importes, mesas y tiempos siempre con números tabulares. Mínimo 11 pt; el texto respeta el tamaño de fuente del sistema.

## Espacio y forma

Escala de 4 pt: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 72. Márgenes de pantalla 20 (celular) / 32 (tablet) / 40 (escritorio); 32 entre secciones; contenido centrado con ancho máximo 960. Radios: 10 control chico · 14 botón · 18 lista/tarjeta · 24 barra flotante · 28 hoja; esquinas `continuous` en iOS. Objetivos táctiles ≥ 48.

## Componentes (`packages/ui`)

- **Screen** — título grande que se compacta al desplazar; barra con blur estático cuyo opacity se anima (nunca la intensidad).
- **Group / Row** — lista agrupada: un bloque redondeado, separador fino con sangría, sin cajas anidadas. Es el contenedor por defecto.
- **Button** — `filled` (una sola por pantalla), `tinted`, `plain`, `destructive`; 54/48/36 de alto.
- **Segmented** — pastilla que se desliza con resorte; **Chip** para filtros con contador.
- **Sheet** — hoja inferior en celular (arrastre por velocidad o distancia, rebote solo si hubo inercia); panel centrado en tablet/escritorio.
- **Stepper**, **StatusPill**, **Toast**, **EmptyState**, **Skeleton**, **ErrorBanner**, **Field**.
- **AppTabBar** (en la app) — barra inferior translúcida en celular, riel/barra lateral en tablet/escritorio; el cambio de pestaña no se anima.

## Movimiento

Resorte `{duration 400, dampingRatio 1}` al asentar; `{320, 0.82}` en hojas y píldoras; ease-out `cubic-bezier(.23,1,.32,1)` en entradas (≤ 300 ms); feedback de toque: escala 0.97 en 120 ms al apoyar (no al soltar). Solo `transform` y `opacity` (excepción: elementos absolutos sin hijos). Todo corre en el hilo de UI (Reanimated). Con "reducir movimiento": solo opacidad. Sin animación en lo que se usa cientos de veces por turno (cambiar de pestaña, abrir el teclado). Háptica: una sola por acción y siempre con cambio visual (selección, confirmación ligera, éxito/error); inexistente en web.

## No hacer

Cajas dentro de cajas; eyebrows/kickers sobre los títulos; vidrio como decoración; borde de color > 1 px a un lado; degradado en textos; el color como único indicador de estado; animar `height`/`width` en listas; animar la intensidad de un blur; `scale(0)`; ease-in en UI; animar un cambio de pestaña.
