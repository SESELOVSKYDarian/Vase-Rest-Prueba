# NOCTUA con PostgreSQL

El proyecto ya no requiere Supabase. La arquitectura local incluye PostgreSQL 16, la API Express y el frontend Next.js.

## Inicio local con Docker

1. Copiar `.env.docker.example` como `.env` y cambiar todas las claves.
2. Ejecutar `docker compose up --build -d`.
3. Abrir `http://localhost:3000`.
4. Verificar la API en `http://localhost:3001/health`.

Las migraciones de `database/init` se ejecutan automáticamente al iniciar el backend. El volumen `postgres_data` conserva los datos entre reinicios. El usuario inicial es `admin` y su contraseña se toma de `INITIAL_ADMIN_PASSWORD` (por defecto local: `1234`).

## Desarrollo sin contenerizar Node

Se necesita PostgreSQL local en el puerto 5432. Crear la base `noctua`, configurar `backend-reservas/.env` y ejecutar:

```powershell
cd backend-reservas
npm install
npm run dev
```

En otra terminal:

```powershell
cd noctua
npm install
npm run dev
```

## Migrar los datos existentes

Supabase usa PostgreSQL, por lo que la migración copia directamente entre ambas bases sin usar su SDK:

```powershell
cd backend-reservas
$env:SOURCE_DATABASE_URL='postgresql://postgres:CLAVE@HOST_SUPABASE:5432/postgres'
$env:DATABASE_URL='postgresql://noctua:CLAVE@localhost:5432/noctua'
npm run migrate:data
```

Primero debe arrancarse una vez el backend destino para crear el esquema. Las contraseñas administradas anteriormente por Supabase Auth no son exportables como texto; cada usuario debe establecer una contraseña nueva en NOCTUA.

## Copias de seguridad

```bash
docker compose exec postgres pg_dump -U noctua -d noctua -Fc -f /tmp/noctua.dump
docker compose cp postgres:/tmp/noctua.dump ./noctua.dump
```
