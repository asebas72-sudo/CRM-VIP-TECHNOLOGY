-- =====================================================================
-- CRM VIP TECHNOLOGY - Facturas compras: quitar la empresa asignada
-- automáticamente a las facturas del correo.
-- Desde ahora entran sin empresa y el superadmin la elige. Este script
-- deja "Sin asignar" las que ya estaban asignadas y AÚN NO se han
-- cargado a Compras (las ya cargadas no se tocan).
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

update facturas_correo f
set empresa_id = null
where f.compra_id is null
  and f.sin_empresa = false
  and not exists (select 1 from compras c where c.cufe = f.cufe);
