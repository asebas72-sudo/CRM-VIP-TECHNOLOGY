-- =====================================================================
-- CRM VIP TECHNOLOGY - Nuevo rol "tecnico" (servicio técnico)
-- Ejecutar SOLO este archivo primero en Supabase > SQL Editor y luego
-- el 0009 (Postgres exige confirmar el nuevo valor antes de usarlo).
-- =====================================================================

alter type rol_usuario add value if not exists 'tecnico';
