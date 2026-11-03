-- =====================================================================
-- CRM VIP TECHNOLOGY - Compras desde foto/manual y ubicación (DIVIPOLA)
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

-- Origen de la compra y archivo de soporte (foto o PDF del recibo)
alter table compras
  add column if not exists origen text not null default 'xml' check (origen in ('xml', 'foto', 'manual')),
  add column if not exists soporte_path text,
  add column if not exists tipo_documento text;

-- Departamento y ciudad desde lista oficial
alter table empresas add column if not exists departamento text;
alter table clientes
  add column if not exists departamento text,
  add column if not exists ciudad text,
  add column if not exists direccion text;
alter table proveedores
  add column if not exists departamento text,
  add column if not exists ciudad text;

-- Los miembros pueden actualizar datos de clientes (ciudad, teléfono...)
-- (ya existe la política "miembros editan" sobre clientes desde 0001)
