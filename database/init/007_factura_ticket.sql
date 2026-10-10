-- Pedidos de factura hechos por el cliente desde su comprobante. El local los emite en ARCA
-- (con sus propias credenciales) y acá deja constancia del número de comprobante.
create table if not exists public.solicitudes_factura (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null unique references public.pagos_qr(id) on delete cascade,
  tipo_comprobante text not null check (tipo_comprobante in ('A', 'B', 'C')),
  condicion_iva text not null check (condicion_iva in ('consumidor_final', 'responsable_inscripto', 'monotributo', 'exento')),
  doc_tipo text not null check (doc_tipo in ('DNI', 'CUIT', 'CUIL')),
  doc_numero text not null,
  nombre text not null,
  email text,
  domicilio text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'emitida', 'rechazada')),
  numero_factura text,
  nota_local text,
  creada_en timestamptz not null default now(),
  emitida_en timestamptz,
  emitida_por text
);
create index if not exists solicitudes_factura_estado_idx on public.solicitudes_factura (estado, creada_en);
alter table public.solicitudes_factura enable row level security;
