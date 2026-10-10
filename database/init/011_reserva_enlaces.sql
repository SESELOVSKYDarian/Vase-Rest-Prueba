-- Enlaces cortos para elegir la mesa mirando el plano (el código viaja en el link que manda WhatsApp).
create table if not exists public.reserva_enlaces (
  codigo text primary key,
  telefono text not null,
  fecha_iso text not null,
  hora text not null,
  personas integer not null,
  nombre text,
  expira_en timestamptz not null,
  creado_en timestamptz not null default now()
);
create index if not exists reserva_enlaces_exp_idx on public.reserva_enlaces (expira_en);
alter table public.reserva_enlaces enable row level security;
