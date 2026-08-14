-- NOCTUA - esquema completo inicial para PostgreSQL/PostgreSQL
-- Ejecutar una sola vez desde PostgreSQL > SQL Editor.
-- Este script es idempotente en la medida de lo posible.
-- IMPORTANTE: no reemplaza la autenticación; el backend debe usar service_role
-- únicamente del lado servidor.

create extension if not exists pgcrypto;

do $$ begin create type public.user_role as enum ('admin','encargado','mozo','cocina','cajero','soporte'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mesa_estado as enum ('libre','reservada','ocupada','esperando_pedido','pedido_listo','mantenimiento'); exception when duplicate_object then null; end $$;
do $$ begin create type public.pedido_estado as enum ('abierto','en_preparacion','listo','entregado','cerrado','cancelado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.reserva_estado as enum ('pendiente','confirmada','cancelada','finalizada','no_show'); exception when duplicate_object then null; end $$;
do $$ begin create type public.factura_estado as enum ('pendiente','autorizada','rechazada','anulada'); exception when duplicate_object then null; end $$;

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(), nombre varchar(120) not null,
  username varchar(80) not null unique, rol public.user_role not null default 'mozo',
  activo boolean not null default true, auth_user_id uuid unique, creado_en timestamptz not null default now()
);

create table if not exists public.mesas (
  id uuid primary key default gen_random_uuid(), numero integer not null unique,
  capacidad integer not null default 2 check (capacidad > 0), pos_x numeric default 0,
  pos_y numeric default 0, estado public.mesa_estado not null default 'libre',
  piso text default 'Planta baja', zona text default 'Principal', forma text default 'redonda',
  disponible boolean not null default true, creada_en timestamptz not null default now()
);

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(), nombre varchar(120) not null unique,
  color varchar(30), orden integer not null default 0, activo boolean not null default true
);

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(), categoria_id uuid references public.categorias(id) on delete set null,
  nombre varchar(160) not null, descripcion text, precio numeric(12,2) not null default 0 check (precio >= 0),
  imagen_url text, stock_actual numeric(12,3) not null default 0, stock integer not null default 0,
  disponible boolean not null default true, activo boolean not null default true, creado_en timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(), nombre varchar(160) not null, telefono varchar(50),
  email varchar(180), documento varchar(40), observaciones text, creado_en timestamptz not null default now()
);

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(), mesa_id uuid references public.mesas(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null, nombre_cliente varchar(160) not null,
  telefono varchar(50) not null, email varchar(180), cantidad_personas integer not null check (cantidad_personas > 0),
  fecha_hora_inicio timestamptz not null, fecha_hora_fin timestamptz not null,
  estado public.reserva_estado not null default 'pendiente', observaciones text, creado_en timestamptz not null default now()
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(), mesa_id uuid references public.mesas(id) on delete set null,
  usuario_id uuid references public.usuarios(id) on delete set null, cliente_id uuid references public.clientes(id) on delete set null,
  estado public.pedido_estado not null default 'abierto', subtotal numeric(12,2) not null default 0,
  impuestos numeric(12,2) not null default 0, total numeric(12,2) not null default 0,
  comensales integer check (comensales is null or comensales > 0), abierto_en timestamptz not null default now(),
  cerrado_en timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.pedido_items (
  id uuid primary key default gen_random_uuid(), pedido_id uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict, cantidad numeric(12,3) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null default 0, subtotal numeric(12,2) not null default 0,
  notas text, estado text not null default 'pendiente', creado_en timestamptz not null default now()
);

create table if not exists public.ingredientes (
  id uuid primary key default gen_random_uuid(), nombre varchar(160) not null, unidad_medida varchar(30) not null,
  stock_actual numeric(12,3) not null default 0 check (stock_actual >= 0), stock_minimo numeric(12,3) not null default 0,
  costo_unitario numeric(12,2) not null default 0, fecha_vencimiento date, activo boolean not null default true, creado_en timestamptz not null default now()
);

create table if not exists public.producto_ingredientes (
  id uuid primary key default gen_random_uuid(), producto_id uuid not null references public.productos(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id) on delete cascade, cantidad_necesaria numeric(12,3) not null check (cantidad_necesaria > 0),
  unidad varchar(30) not null, unique(producto_id, ingrediente_id)
);

create table if not exists public.movimientos_stock (
  id uuid primary key default gen_random_uuid(), producto_id uuid references public.productos(id) on delete set null,
  ingrediente_id uuid references public.ingredientes(id) on delete set null, pedido_id uuid references public.pedidos(id) on delete set null,
  tipo text not null check (tipo in ('entrada','salida','ajuste','merma','devolucion')),
  cantidad numeric(12,3) not null, motivo text, creado_por text, creado_en timestamptz not null default now()
);

create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(), pedido_id uuid not null unique references public.pedidos(id) on delete restrict,
  tipo_comprobante text not null default 'interno', punto_venta integer, numero_comprobante bigint,
  concepto integer not null default 1, tipo_documento integer not null default 99, numero_documento text default '0',
  importe_neto numeric(12,2) not null default 0, importe_iva numeric(12,2) not null default 0, importe_total numeric(12,2) not null default 0,
  metodo_pago text not null default 'efectivo', cae text, vencimiento_cae date, resultado_arca text,
  estado public.factura_estado not null default 'pendiente', observaciones text, creado_en timestamptz not null default now()
);

create table if not exists public.movimientos_caja (
  id uuid primary key default gen_random_uuid(), pedido_id uuid references public.pedidos(id) on delete set null,
  mesa_id uuid references public.mesas(id) on delete set null, tipo text not null check (tipo in ('ingreso_no_fiscal','egreso','ajuste')),
  metodo text not null default 'efectivo', importe numeric(12,2) not null check (importe >= 0), motivo text not null,
  observacion text, creado_por text, creado_en timestamptz not null default now()
);

create table if not exists public.mozos (
  id uuid primary key default gen_random_uuid(), nombre varchar(100) not null, apellido varchar(100) not null,
  zona text not null, posicion_ciclo integer not null default 0, activo boolean not null default true, creado_en timestamptz not null default now()
);

create table if not exists public.promociones (
  id uuid primary key default gen_random_uuid(), nombre varchar(160) not null, descripcion text,
  tipo text not null default 'porcentaje', valor numeric(12,2) not null default 0, fecha_inicio date,
  fecha_fin date, activo boolean not null default true, creado_en timestamptz not null default now()
);

create table if not exists public.promocion_productos (
  promocion_id uuid not null references public.promociones(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  primary key(promocion_id, producto_id)
);

create table if not exists public.tickets_soporte (
  id uuid primary key default gen_random_uuid(), usuario_id uuid references public.usuarios(id) on delete set null,
  asunto varchar(200) not null, descripcion text not null, categoria text, estado text not null default 'abierto',
  prioridad text not null default 'media', creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);

create index if not exists idx_reservas_fecha on public.reservas(fecha_hora_inicio, fecha_hora_fin);
create index if not exists idx_pedidos_estado on public.pedidos(estado);
create index if not exists idx_pedidos_mesa on public.pedidos(mesa_id);
create index if not exists idx_items_pedido on public.pedido_items(pedido_id);
create index if not exists idx_mov_stock_ingrediente on public.movimientos_stock(ingrediente_id);
create index if not exists idx_mov_caja_fecha on public.movimientos_caja(creado_en);

-- Datos iniciales mínimos. No pisa datos existentes.
insert into public.categorias(nombre, color, orden) values
  ('Entradas','#E9C46A',1),('Principales','#2A9D8F',2),('Bebidas','#5AA9E6',3),('Postres','#E76F51',4)
on conflict (nombre) do nothing;

-- Para una primera puesta en marcha local. En producción conviene restringir estas políticas
-- y exigir usuarios authenticated con roles reales.
alter table public.usuarios enable row level security;
alter table public.mesas enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.reservas enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;
alter table public.ingredientes enable row level security;
alter table public.producto_ingredientes enable row level security;
alter table public.mozos enable row level security;

do $$ declare t text; begin
  foreach t in array array['usuarios','mesas','categorias','productos','reservas','pedidos','pedido_items','ingredientes','producto_ingredientes','mozos'] loop
    execute format('drop policy if exists noctua_local_access on public.%I', t);
    execute format('create policy noctua_local_access on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

