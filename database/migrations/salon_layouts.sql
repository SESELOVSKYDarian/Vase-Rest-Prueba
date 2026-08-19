-- Persistencia del plano Fabric: mesas, sillas, sillones y objetos del salón.
create table if not exists public.salon_layouts (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.salon_layouts enable row level security;
drop policy if exists noctua_local_access on public.salon_layouts;
create policy noctua_local_access on public.salon_layouts
  for all to anon, authenticated using (true) with check (true);
