-- Avisos en la pantalla bloqueada: un token por celular/tablet con la app instalada.
create table if not exists public.dispositivos_push (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  token text not null unique,
  plataforma text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists dispositivos_push_usuario_idx on public.dispositivos_push (usuario_id);

-- Cada aviso se manda una sola vez, aunque el servidor se reinicie o lo detecte dos veces.
create table if not exists public.push_enviados (
  clave text primary key,
  creado_en timestamptz not null default now()
);
alter table public.dispositivos_push enable row level security;
alter table public.push_enviados enable row level security;
