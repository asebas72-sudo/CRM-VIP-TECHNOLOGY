-- =====================================================================
-- CRM VIP TECHNOLOGY - Mensajes de WhatsApp configurables (servicio técnico)
-- Guarda por empresa los textos que el administrador personaliza en
-- Reparaciones > Configuración. Lo que no se personaliza usa el texto
-- original del sistema.
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

alter table empresas add column if not exists mensajes_servicio jsonb not null default '{}'::jsonb;
