#!/usr/bin/env bash
# Prueba de seguridad contra un servidor en marcha (desarrollo). Uso: scripts/probar-seguridad.sh [http://localhost:3001/api]
# Necesita los usuarios de ejemplo (mozo/cocina/encargado/admin); no lo uses contra producción.
A="${1:-http://localhost:3001/api}"
fallos=0
tok() { curl -s -XPOST "$A/auth/login" -H 'content-type: application/json' -d "{\"usuario\":\"$1\",\"password\":\"$2\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
espera() { # descripcion esperado obtenido
  if [ "$2" = "$3" ]; then printf "  ok    %-52s %s\n" "$1" "$3"; else printf "  FALLA %-52s esperado %s, obtuvo %s\n" "$1" "$2" "$3"; fallos=$((fallos+1)); fi
}
J='content-type: application/json'
MT=$(tok mozo mozo123); AT=$(tok admin "${ADMIN_PASSWORD:-1234}"); CT=$(tok cocina cocina123); ET=$(tok encargado encargado123)
echo "Sin sesión"
for p in usuarios mesas reservas productos pedidos facturas categorias; do espera "GET /$p" 401 "$(code "$A/$p")"; done
espera "POST /mesas" 401 "$(code -XPOST "$A/mesas" -H "$J" -d '{}')"
espera "cabecera x-noctua-role falsa no da acceso" 401 "$(code "$A/facturas" -H 'x-noctua-role: admin')"
espera "token falso" 401 "$(code "$A/pedidos" -H 'authorization: Bearer abc.def.ghi')"
echo "Mozo"
q() { code -XPOST "$A/data/query" -H "authorization: Bearer $1" -H "$J" -d "$2"; }
espera "data: leer usuarios" 403 "$(q "$MT" '{"table":"usuarios"}')"
espera "data: leer integraciones" 403 "$(q "$MT" '{"table":"integraciones"}')"
espera "data: leer facturas" 403 "$(q "$MT" '{"table":"facturas"}')"
espera "data: cambiar precio de un producto" 403 "$(q "$MT" '{"table":"productos","operation":"update","payload":{"precio":1},"filters":[{"method":"eq","column":"nombre","value":"x"}]}')"
espera "data: update sin filtro" 400 "$(q "$MT" '{"table":"mesas","operation":"update","payload":{"estado":"libre"}}')"
espera "data: tabla inexistente" 400 "$(q "$MT" '{"table":"pg_shadow"}')"
espera "data: leer mesas (permitido)" 200 "$(q "$MT" '{"table":"mesas"}')"
espera "DELETE /pedidos/:id" 403 "$(code -XDELETE "$A/pedidos/00000000-0000-0000-0000-000000000000" -H "authorization: Bearer $MT")"
espera "crear usuario admin" 403 "$(code -XPOST "$A/usuarios/admin" -H "authorization: Bearer $MT" -H "$J" -d '{"accion":"crear","email":"a@b.c","password":"12345678","rol":"admin"}')"
espera "listar usuarios" 403 "$(code "$A/usuarios" -H "authorization: Bearer $MT")"
espera "GET /pedidos (permitido)" 200 "$(code "$A/pedidos" -H "authorization: Bearer $MT")"
espera "GET /carta-admin/config (permitido)" 200 "$(code "$A/carta-admin/config" -H "authorization: Bearer $MT")"
espera "PUT /carta-admin/config" 403 "$(code -XPUT "$A/carta-admin/config" -H "authorization: Bearer $MT" -H "$J" -d '{}')"
espera "inteligencia/calor (ventas)" 403 "$(code "$A/inteligencia/calor" -H "authorization: Bearer $MT")"
echo "Cocina"
espera "GET /facturas" 403 "$(code "$A/facturas" -H "authorization: Bearer $CT")"
echo "Admin / encargado"
espera "data: leer usuarios (admin)" 200 "$(q "$AT" '{"table":"usuarios"}')"
espera "GET /usuarios (encargado)" 200 "$(code "$A/usuarios" -H "authorization: Bearer $ET")"
n=$(curl -s -XPOST "$A/data/query" -H "authorization: Bearer $AT" -H "$J" -d '{"table":"pedidos","selection":"*, usuarios(*)","limit":5}' | grep -c password_hash)
espera "ninguna respuesta trae password_hash" 0 "$n"
n=$(curl -s -XPOST "$A/data/query" -H "authorization: Bearer $AT" -H "$J" -d '{"table":"usuarios"}' | grep -c -E "password_hash|auth_user_id")
espera "ni leyendo usuarios" 0 "$n"
echo "Cabeceras"
h=$(curl -sI "$A/../health")
for c in "x-content-type-options: nosniff" "x-frame-options: DENY" "referrer-policy: no-referrer" "content-security-policy"; do
  if echo "$h" | grep -qi "$c"; then espera "cabecera $c" 1 1; else espera "cabecera $c" 1 0; fi
done
if echo "$h" | grep -qi "x-powered-by"; then espera "sin X-Powered-By" 0 1; else espera "sin X-Powered-By" 0 0; fi
echo "Fuerza bruta"
r=""; for i in $(seq 1 10); do r="$r $(code -XPOST "$A/auth/login" -H "$J" -d '{"usuario":"victima-prueba","password":"mal"}')"; done
echo "  intentos:$r"
espera "se frena (429) tras varios errores" 1 "$(echo "$r" | grep -c 429 | sed 's/^[1-9].*/1/')"
echo
[ "$fallos" -eq 0 ] && echo "TODO BIEN" || { echo "$fallos FALLAS"; exit 1; }
