-- =====================================================================
-- CRM VIP TECHNOLOGY - Compras > Consultar compras
-- Administradores y bodega de cada empresa ven las facturas que llegaron
-- al correo asignadas a SU empresa, para cargarlas al inventario.
-- (El buzón completo, los pagos y la configuración siguen siendo solo
-- del superadmin.)
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

drop policy if exists "compras ve facturas de su empresa" on facturas_correo;
create policy "compras ve facturas de su empresa" on facturas_correo for select
  using (empresa_id is not null and rol_en(empresa_id)::text in ('admin', 'bodega'));

-- Al cargarla al inventario se marca la factura con su compra
drop policy if exists "compras marca factura cargada" on facturas_correo;
create policy "compras marca factura cargada" on facturas_correo for update
  using (empresa_id is not null and rol_en(empresa_id)::text in ('admin', 'bodega'))
  with check (empresa_id is not null and rol_en(empresa_id)::text in ('admin', 'bodega'));
