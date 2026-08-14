FROM node:20-alpine AS backend-deps
WORKDIR /build/backend-reservas
COPY backend-reservas/package.json backend-reservas/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS frontend-deps
WORKDIR /build/noctua
COPY noctua/package.json noctua/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS frontend-builder
WORKDIR /build/noctua
ARG NEXT_PUBLIC_API_URL=/backend-api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
COPY --from=frontend-deps /build/noctua/node_modules ./node_modules
COPY noctua ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    FRONTEND_PORT=3000 \
    INTERNAL_API_URL=http://127.0.0.1:3001/api \
    NEXT_PUBLIC_API_URL=/backend-api \
    MIGRATIONS_DIR=/app/database/init

RUN apk add --no-cache libc6-compat openssl

COPY --from=backend-deps /build/backend-reservas/node_modules ./backend-reservas/node_modules
COPY backend-reservas/package.json ./backend-reservas/
COPY backend-reservas/prisma ./backend-reservas/prisma
COPY backend-reservas/src ./backend-reservas/src
COPY backend-reservas/sql ./backend-reservas/sql
COPY backend-reservas/scripts ./backend-reservas/scripts
COPY database ./database

COPY --from=frontend-builder /build/noctua/public ./noctua/public
COPY --from=frontend-builder /build/noctua/.next/standalone/noctua ./noctua
COPY --from=frontend-builder /build/noctua/.next/static ./noctua/.next/static
COPY scripts/start-all.mjs ./scripts/start-all.mjs

RUN cd /app/backend-reservas && ./node_modules/.bin/prisma generate

EXPOSE 3000
CMD ["node", "scripts/start-all.mjs"]
