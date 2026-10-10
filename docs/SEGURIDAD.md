# Seguridad

Revisión hecha sobre el código y probada contra un servidor real. Reproducible con `scripts/probar-seguridad.sh` (solo desarrollo: usa los usuarios de ejemplo).

## Qué se encontró y se corrigió

| Gravedad | Hallazgo | Arreglo |
| --- | --- | --- |
| Crítica | `mesas`, `reservas`, `productos`, `pedidos`, `facturas`, `categorias` y `usuarios` respondían **sin sesión**: cualquiera en internet podía leer facturas y caja, borrar mesas o productos, cancelar pedidos. | Todo exige sesión; lo que modifica datos delicados exige además el rol (`utils/seguridad.js`, `app.js`). |
| Crítica | `POST /api/data/query` dejaba a **cualquier usuario con sesión** (un mozo, cocina) leer y escribir cualquier tabla: hashes de contraseñas, roles (subirse a admin), facturas, credenciales de integraciones. | Política por tabla y rol; `update`/`delete` sin filtro rechazados; `password_hash` y `auth_user_id` se quitan de toda respuesta. |
| Crítica | Cualquier usuario con sesión podía crear usuarios y cambiar roles (`/usuarios/admin`). | Solo admin; rol validado; contraseña mínima de 8. |
| Alta | Las identidades por cabecera (`x-noctua-role`) se aceptaban sin token. | Con sesión obligatoria, la identidad sale solo del token firmado. |
| Alta | El admin volvía a `1234` en cada arranque; JWT y claves de ejemplo en `docker-compose`. | El admin solo se escribe si no tiene contraseña (`RESET_ADMIN_PASSWORD=true` para forzar); en producción el servidor **no arranca** con secretos de ejemplo; compose exige secretos propios. |
| Alta | Sin freno a la fuerza bruta del login. | 15 intentos/min por IP y bloqueo de 10 min tras 8 errores del mismo usuario; el tiempo de respuesta ya no delata si el usuario existe. |
| Media | Sin cabeceras defensivas; `X-Powered-By` visible; respuestas autenticadas cacheables. | `nosniff`, `X-Frame-Options`, CSP estricta de API, `Referrer-Policy`, HSTS en producción, `Cache-Control: no-store`. |
| Media | CORS aceptaba cualquier `localhost` también en producción. | Solo fuera de producción. |
| Media | Simulador de WhatsApp activo por defecto. | Apagado salvo `WHATSAPP_SIMULADOR=true` (y nunca en producción ni con la cuenta real). |
| Media | Dependencias con vulnerabilidades. | `npm audit fix` en el backend; quedan 3 altas de `prisma` (herramienta de build, no se usa en ejecución). |

Ya estaba bien y se mantuvo: consultas SQL parametrizadas e identificadores validados, subida de imágenes por firma binaria y tamaño, firma HMAC de los avisos de WhatsApp (comparación en tiempo constante), pagos y montos calculados siempre en el servidor, límites por IP en los endpoints públicos, escape del HTML de tickets y QR.

## Pendiente / decisiones tuyas

- **El panel Next (`noctua/`)**: ahora manda el token en cada llamada. Si algún flujo viejo falla con 401, es que le falta ese encabezado.
- **Token de sesión en la web**: se guarda en el almacenamiento del navegador (en celular, en el llavero seguro). Una CSP en el sitio web de la app y no cargar scripts de terceros reduce el riesgo de robo por XSS.
- **Prisma**: está solo para generar tipos en el build; conviene quitarlo si no se usa.
- **Mercado Pago, ARCA, WhatsApp, Expo Push**: sin credenciales reales no se probaron contra sus servicios. Las claves van solo en variables de entorno, nunca en el código.

## Cloudflare (recomendado delante del servidor)

No había una skill de Cloudflare disponible en este entorno; esto es la configuración que corresponde a lo que la app expone, a aplicar en el panel de Cloudflare.

1. **Proxy y TLS**: DNS en modo *proxied*, SSL/TLS **Full (strict)**, *Always Use HTTPS*, TLS mínimo 1.2, HSTS.
2. **Cerrar el origen** a Cloudflare: Cloudflare Tunnel (`cloudflared`) o reglas de firewall que solo acepten rangos de Cloudflare / *Authenticated Origin Pulls*. Recién ahí poné `TRUST_PROXY=1` y `TRUST_CLOUDFLARE=true` (la app usa `CF-Connecting-IP` para sus límites; si el origen estuviera abierto, ese encabezado se podría falsificar).
3. **Rate limiting (WAF)** — la app ya limita por IP; Cloudflare lo hace antes de llegar al servidor:
   - `/api/auth/login`: 10 req/min por IP → bloquear 10 min.
   - `/api/public/*` (carta, QR, pagos, reservas): 120 req/min por IP; `POST` a `/api/public/*`: 20/min.
   - `/api/public/asistente`: 12/min (cuesta dinero si hay IA).
4. **Turnstile** (CAPTCHA sin fricción) en el formulario de pedido de factura y en el envío de reservas públicas, si aparece abuso.
5. **Reglas WAF**: *Managed Rules* + *OWASP Core* en modo bloqueo; *Bot Fight Mode*; bloquear países desde donde no atendés si querés (con cuidado: los turistas piden la carta).
6. **WhatsApp**: permitir `POST /api/whatsapp/webhook` solo desde los rangos de Meta (o dejar la ruta pública y confiar en la firma HMAC, que la app ya valida).
7. **Caché**: cachear `/uploads/*` (inmutables) y `GET /api/public/carta*` 20–60 s; **no** cachear nada más de `/api/*` (las respuestas ya van con `no-store`).
8. **Sitio web de la app** (si se publica la versión web): cabeceras `Content-Security-Policy` (sin `unsafe-eval`), `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy` desde *Transform Rules*.
9. **Secretos**: Cloudflare no los necesita; los secretos de la app van en el panel del hosting (EasyPanel/Docker), no en el repositorio.
