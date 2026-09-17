alter table public.promociones
  add column if not exists metodos_pago text[] not null default '{}';
