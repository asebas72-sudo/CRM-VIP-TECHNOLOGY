-- =====================================================================
-- CRM VIP TECHNOLOGY - Procesar facturas de compra desde el correo
-- (migrado del Apps Script "Extractor de facturas electrónicas")
--
-- El servidor lee la cuenta de Gmail configurada cada 15 minutos:
--   * Correos con .zip -> XML de factura DIAN -> facturas_correo
--   * Correos "Pago de:" -> líneas de pago     -> pagos_correo
-- Solo el superadmin ve y gestiona este módulo.
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

-- Configuración (una sola fila)
create table if not exists buzon_config (
  id int primary key default 1 check (id = 1),
  remitentes text[] not null default array['andres06023@hotmail.com', 'comercial@viptechnology.co', 'grupo-vip@outlook.es'],
  asunto_pagos text not null default 'Pago de:',
  prefijo_factura_pago text not null default 'VPFE',
  fecha_inicio date not null default '2026-08-31',
  ultima_revision timestamptz,
  ultimo_resultado text
);
insert into buzon_config (id) values (1) on conflict (id) do nothing;

-- Correos ya leídos (para no procesarlos dos veces)
create table if not exists correos_procesados (
  id text primary key,                 -- identificador del mensaje en Gmail
  tipo text not null check (tipo in ('factura', 'pago')),
  estado text not null check (estado in ('ok', 'error', 'sin_datos')),
  detalle text,
  asunto text,
  remitente text,
  fecha_correo timestamptz,
  procesado_en timestamptz not null default now()
);

-- Facturas recibidas por correo
create table if not exists facturas_correo (
  id uuid primary key default gen_random_uuid(),
  cufe text not null unique,
  numero text,
  fecha_documento date,
  proveedor_nombre text,
  proveedor_nit text,
  cliente_nombre text,
  cliente_nit text,
  monto numeric(14,2),
  -- Empresa a la que corresponde (por NIT del comprador o asignada a mano)
  empresa_id uuid references empresas(id) on delete set null,
  asunto text,
  remitente text,
  archivo text,
  correo_id text references correos_procesados(id) on delete set null,
  xml text not null,                   -- XML completo, para importarlo a Compras
  compra_id uuid references compras(id) on delete set null,
  cuenti boolean not null default false,
  cuenti_por uuid references auth.users(id),
  cuenti_en timestamptz,
  creado_en timestamptz not null default now()
);
create index if not exists facturas_correo_fecha_idx on facturas_correo (fecha_documento desc);

-- Líneas de pago recibidas por correo
create table if not exists pagos_correo (
  id uuid primary key default gen_random_uuid(),
  id_linea text not null unique,       -- mensaje + número de línea
  fecha_pago date,
  fecha_pago_texto text,
  empresa_pagadora text,
  cuenta text,
  banco text,
  valor_total numeric(14,2),
  nro_factura text,
  nro_factura_proveedor text,
  valor_pagado numeric(14,2),
  retefte numeric(14,2),
  asunto text,
  remitente text,
  correo_id text references correos_procesados(id) on delete set null,
  cuenti boolean not null default false,
  cuenti_por uuid references auth.users(id),
  cuenti_en timestamptz,
  creado_en timestamptz not null default now()
);
create index if not exists pagos_correo_fecha_idx on pagos_correo (fecha_pago desc);

-- Solo el superadmin (el proceso automático usa la clave secreta del servidor)
alter table buzon_config enable row level security;
alter table correos_procesados enable row level security;
alter table facturas_correo enable row level security;
alter table pagos_correo enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['buzon_config', 'correos_procesados', 'facturas_correo', 'pagos_correo'] loop
    execute format('drop policy if exists "superadmin" on %I', t);
    execute format('create policy "superadmin" on %I for all using (tiene_acceso_total()) with check (tiene_acceso_total())', t);
  end loop;
end $$;
