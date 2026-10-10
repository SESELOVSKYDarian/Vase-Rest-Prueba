-- Reservas y pedidos para llevar por WhatsApp.

-- Un pedido puede ser de salón (con mesa) o para llevar (con cliente y hora de retiro).
alter table public.pedidos add column if not exists tipo text not null default 'salon';
do $$ begin
  alter table public.pedidos add constraint pedidos_tipo_check check (tipo in ('salon', 'llevar'));
exception when duplicate_object then null; end $$;
alter table public.pedidos add column if not exists cliente_nombre text;
alter table public.pedidos add column if not exists cliente_telefono text;
alter table public.pedidos add column if not exists retiro_para timestamptz;
alter table public.pedidos add column if not exists origen text;
create index if not exists pedidos_llevar_idx on public.pedidos (tipo, estado) where tipo = 'llevar';

alter table public.reservas add column if not exists origen text;

-- Estado de cada conversación (en qué paso va y lo que ya contó la persona).
create table if not exists public.whatsapp_sesiones (
  telefono text primary key,
  estado text not null default 'inicio',
  datos jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

-- Registro de mensajes: sirve para no procesar dos veces el mismo (Meta reintenta) y para revisar qué pasó.
create table if not exists public.whatsapp_mensajes (
  id uuid primary key default gen_random_uuid(),
  telefono text not null,
  direccion text not null check (direccion in ('entrante', 'saliente')),
  texto text not null,
  wa_id text unique,
  creado_en timestamptz not null default now()
);
create index if not exists whatsapp_mensajes_tel_idx on public.whatsapp_mensajes (telefono, creado_en desc);
alter table public.whatsapp_sesiones enable row level security;
alter table public.whatsapp_mensajes enable row level security;
