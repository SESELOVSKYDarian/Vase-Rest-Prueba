-- Plano con inteligencia: desde cuándo está cada pedido en su estado (para detectar demoras),
-- mozo asignado a cada mesa y registro de asignaciones para repartir con justicia.

alter table public.pedidos add column if not exists estado_desde timestamptz;
update public.pedidos set estado_desde = coalesce(abierto_en, created_at, now()) where estado_desde is null;
alter table public.pedidos alter column estado_desde set default now();

create or replace function public.pedidos_marcar_estado_desde() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.estado_desde := coalesce(new.estado_desde, now());
  elsif new.estado is distinct from old.estado then
    new.estado_desde := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists pedidos_estado_desde on public.pedidos;
create trigger pedidos_estado_desde before insert or update of estado on public.pedidos
  for each row execute function public.pedidos_marcar_estado_desde();

alter table public.mesas add column if not exists mozo_id uuid references public.usuarios(id) on delete set null;
alter table public.mesas add column if not exists asignada_en timestamptz;

-- Cuando la mesa se libera, el mozo queda libre de ella.
create or replace function public.mesas_liberar_mozo() returns trigger as $$
begin
  if new.estado = 'libre' and old.estado is distinct from 'libre' then
    new.mozo_id := null;
    new.asignada_en := null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists mesas_liberar_mozo on public.mesas;
create trigger mesas_liberar_mozo before update of estado on public.mesas
  for each row execute function public.mesas_liberar_mozo();

create table if not exists public.asignaciones_mesa (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  mozo_id uuid not null references public.usuarios(id) on delete cascade,
  asignada_por text,
  creada_en timestamptz not null default now()
);
create index if not exists asignaciones_mesa_mozo_idx on public.asignaciones_mesa (mozo_id, creada_en desc);
alter table public.asignaciones_mesa enable row level security;

create index if not exists pedidos_cerrados_idx on public.pedidos (mesa_id, cerrado_en) where estado in ('cerrado', 'cerrada');
