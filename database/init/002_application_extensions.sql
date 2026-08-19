alter type public.user_role add value if not exists 'stock';
alter type public.user_role add value if not exists 'delivery';
alter type public.user_role add value if not exists 'desarrollador';
alter type public.pedido_estado add value if not exists 'pendiente';
alter type public.pedido_estado add value if not exists 'preparando';
alter type public.pedido_estado add value if not exists 'lista_para_cobrar';
alter type public.pedido_estado add value if not exists 'cerrada';
alter type public.reserva_estado add value if not exists 'activa';
alter type public.reserva_estado add value if not exists 'completada';
alter type public.factura_estado add value if not exists 'emitida';
alter table public.usuarios add column if not exists email varchar(180) unique;
alter table public.usuarios add column if not exists password_hash text;
alter table public.usuarios add column if not exists actualizado_en timestamptz not null default now();

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(), pedido_id uuid not null references public.pedidos(id) on delete restrict,
  mesa_id uuid references public.mesas(id) on delete set null, cliente_id uuid references public.clientes(id) on delete set null,
  metodo_pago text not null, tipo_comprobante integer not null default 6, monto numeric(12,2) not null default 0,
  estado text not null default 'pendiente', temporal boolean not null default false, recibido_por text,
  monto_recibido numeric(12,2), vuelto numeric(12,2), referencia_pago text, idempotency_key text unique,
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
alter table public.pagos add column if not exists tipo_tarjeta text;
alter table public.pagos add column if not exists marca_tarjeta text;
alter table public.pagos add column if not exists banco_tarjeta text;
alter table public.pagos add column if not exists proveedor_billetera text;
alter table public.pagos add column if not exists expira_en timestamptz;
alter table public.pagos add column if not exists confirmado_en timestamptz;
alter table public.facturas add column if not exists pago_id uuid references public.pagos(id);
alter table public.facturas add column if not exists mesa_id uuid references public.mesas(id);
alter table public.facturas add column if not exists cliente_id uuid references public.clientes(id);
alter table public.facturas add column if not exists subtotal numeric(12,2) default 0;
alter table public.facturas add column if not exists impuestos numeric(12,2) default 0;
alter table public.facturas add column if not exists descuento numeric(12,2) default 0;
alter table public.facturas add column if not exists total numeric(12,2) default 0;
alter table public.facturas add column if not exists saldo_pendiente numeric(12,2) default 0;
alter table public.facturas add column if not exists qr_fiscal text;
alter table public.facturas add column if not exists arca_estado text;
alter table public.facturas add column if not exists arca_error text;

create table if not exists public.cuentas_corrientes (
  id uuid primary key default gen_random_uuid(), cliente_id uuid not null unique references public.clientes(id),
  estado text not null default 'activa', restaurante_id uuid, creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create table if not exists public.pagos_cuenta_corriente (
  id uuid primary key default gen_random_uuid(), cliente_id uuid not null references public.clientes(id), cuenta_corriente_id uuid references public.cuentas_corrientes(id),
  importe numeric not null check (importe > 0), moneda text not null default 'ARS', medio_pago text not null, referencia text,
  observaciones text, fecha_pago timestamptz not null default now(), creado_por text, idempotency_key text unique, creado_en timestamptz not null default now()
);
create table if not exists public.movimientos_cuenta_corriente (
  id uuid primary key default gen_random_uuid(), cuenta_corriente_id uuid not null references public.cuentas_corrientes(id), cliente_id uuid not null references public.clientes(id),
  tipo text not null, origen text not null, importe numeric not null check (importe > 0), moneda text not null default 'ARS', fecha timestamptz not null default now(),
  descripcion text not null, factura_id uuid references public.facturas(id), pago_cuenta_corriente_id uuid references public.pagos_cuenta_corriente(id),
  movimiento_revertido_id uuid references public.movimientos_cuenta_corriente(id), creado_por text, restaurante_id uuid,
  idempotency_key text unique, creado_en timestamptz not null default now()
);
alter table public.tickets_soporte add column if not exists auth_user_id uuid;
alter table public.tickets_soporte add column if not exists nombre_usuario text;
alter table public.tickets_soporte add column if not exists rol_usuario text;
alter table public.tickets_soporte add column if not exists respuesta text;
alter table public.tickets_soporte add column if not exists respuesta_interna text;
alter table public.tickets_soporte add column if not exists respondido_en timestamptz;
alter table public.tickets_soporte add column if not exists resuelto_en timestamptz;
create table if not exists public.integraciones (
  id uuid primary key default gen_random_uuid(), tipo text not null, proveedor text not null, pais text,
  configuracion_cifrada text not null, activa boolean not null default true, estado text not null default 'sin_verificar',
  ultimo_error text, verificada_en timestamptz, creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(), unique(tipo, proveedor)
);
-- Documento persistente del plano visual del salón.
create table if not exists public.salon_layouts (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.salon_layouts enable row level security;
drop policy if exists noctua_local_access on public.salon_layouts;
create policy noctua_local_access on public.salon_layouts for all to anon, authenticated using (true) with check (true);
