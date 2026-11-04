-- =====================================================================
-- CRM VIP TECHNOLOGY - Facturas compras: opción "Sin empresa"
-- Marca facturas del correo que no corresponden a ninguna empresa
-- (no se cargan a Compras ni cuentan como pendientes).
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

alter table facturas_correo add column if not exists sin_empresa boolean not null default false;
