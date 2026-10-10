-- Carta que vende sola + circuito del QR de la mesa (pedir → pagar → salir).

-- Etiquetas de cada plato: sin_tacc, vegano, vegetariano, sin_lactosa, picante.
alter table public.productos
  add column if not exists etiquetas text[] not null default '{}';

-- Traducciones de nombres y descripciones, guardadas para no volver a pedirlas.
create table if not exists public.traducciones (
  clave text not null,           -- texto original (ya normalizado)
  idioma text not null,          -- 'en', 'pt'
  texto text not null,
  origen text not null default 'api',
  creado_en timestamptz not null default now(),
  primary key (clave, idioma)
);

-- Lo que el cliente pide desde el QR: el mozo lo confirma antes de que llegue a cocina.
create table if not exists public.solicitudes_mesa (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  tipo text not null check (tipo in ('pedido', 'mozo', 'cuenta')),
  items jsonb not null default '[]'::jsonb,
  nota text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
  creada_en timestamptz not null default now(),
  resuelta_en timestamptz,
  resuelta_por text
);
create index if not exists solicitudes_mesa_estado_idx on public.solicitudes_mesa (estado, creada_en);

-- Pagos hechos desde el QR. `codigo` es el comprobante que se muestra al salir.
create table if not exists public.pagos_qr (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  mesa_id uuid references public.mesas(id) on delete set null,
  metodo text not null check (metodo in ('transferencia', 'mercadopago')),
  monto numeric(12, 2) not null check (monto > 0),
  propina numeric(12, 2) not null default 0 check (propina >= 0),
  detalle jsonb not null default '{}'::jsonb,   -- modo de división y unidades cubiertas
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagado', 'rechazado', 'vencido')),
  mp_preference_id text,
  mp_payment_id text,
  creado_en timestamptz not null default now(),
  pagado_en timestamptz,
  confirmado_por text,
  salida_verificada_en timestamptz,
  salida_verificada_por text,
  salida_verificaciones integer not null default 0
);
create index if not exists pagos_qr_pedido_idx on public.pagos_qr (pedido_id);
create index if not exists pagos_qr_estado_idx on public.pagos_qr (estado, creado_en);

-- Reseñas al pagar: las buenas pueden mostrarse, las malas llegan en privado al local.
create table if not exists public.resenas (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid references public.pagos_qr(id) on delete set null,
  mesa_id uuid references public.mesas(id) on delete set null,
  estrellas integer not null check (estrellas between 1 and 5),
  comentario text,
  creada_en timestamptz not null default now()
);

alter table public.pagos_qr enable row level security;
alter table public.solicitudes_mesa enable row level security;
alter table public.resenas enable row level security;
alter table public.traducciones enable row level security;
