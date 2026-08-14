# Despliegue simplificado en EasyPanel

La aplicación usa un único `Dockerfile` para ejecutar el frontend Next.js y el backend Express. PostgreSQL continúa como servicio independiente para conservar los datos en un volumen persistente.

## 1. Crear PostgreSQL

Creá un servicio PostgreSQL 16 en EasyPanel y copiá su URL interna. No publiques el puerto 5432.

## 2. Crear la aplicación

- Fuente: la raíz de este repositorio.
- Dockerfile: `Dockerfile`.
- Puerto publicado: `3000`.
- Healthcheck: `/login`.
- Dominio: el dominio público de la aplicación.

Variables requeridas:

```env
DATABASE_URL=postgresql://USUARIO:CLAVE@HOST_INTERNO:5432/BASE
DATABASE_SSL=false
CORS_ORIGINS=https://app.tudominio.com
JWT_SECRET=UN_SECRETO_LARGO_Y_ALEATORIO
INTERNAL_API_KEY=OTRO_SECRETO_LARGO_Y_ALEATORIO
INTEGRATION_ENCRYPTION_KEY=UNA_CLAVE_DE_CIFRADO_LARGA
INITIAL_ADMIN_PASSWORD=UNA_CLAVE_INICIAL_SEGURA
```

Variables opcionales para ARCA:

```env
ARCA_MODO=homologacion
ARCA_CUIT=
ARCA_PUNTO_VENTA=1
ARCA_CERTIFICATE_PATH=
ARCA_PRIVATE_KEY_PATH=
```

No hace falta configurar `NEXT_PUBLIC_API_URL` ni publicar el puerto 3001. El frontend envía las solicitudes a `/backend-api` y Next.js las reenvía al backend dentro del mismo contenedor.

## Inicialización automática

En cada deploy el contenedor:

1. Ejecuta `prisma generate`.
2. Aplica con Prisma los scripts PostgreSQL idempotentes de `database/init`.
3. Crea las tablas y extensiones que todavía no existan.
4. Inserta los datos iniciales sin duplicarlos.
5. Inicia backend y frontend, supervisando ambos procesos.

Los redeploys no borran información. El volumen persistente pertenece al servicio PostgreSQL, no al contenedor de la aplicación.

## Desarrollo local con Docker

```bash
docker compose up --build
```

La aplicación queda disponible en `http://localhost:3000`.
