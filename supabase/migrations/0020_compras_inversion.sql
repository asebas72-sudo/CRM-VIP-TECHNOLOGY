-- =====================================================================
-- CRM VIP TECHNOLOGY - Compras marcadas como inversión
--
-- Una compra puede ser "inversión inicial" (capital de los socios para
-- arrancar) en lugar de compra normal de reposición. Se sigue tratando
-- igual en el inventario; solo cambia cómo se ve en los informes: no se
-- resta de lo que entró por ventas en el cuadre.
-- El superadmin la marca o desmarca desde Editar compra.
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

alter table compras add column if not exists es_inversion boolean not null default false;

-- Marcar o desmarcar una compra como inversión (solo superadmin)
create or replace function editar_compra_inversion(p_compra uuid, p_es_inversion boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not tiene_acceso_total() then
    raise exception 'Solo un superadmin puede modificar compras';
  end if;
  update compras set es_inversion = p_es_inversion where id = p_compra;
  if not found then
    raise exception 'La compra no existe';
  end if;
end;
$$;

revoke execute on function editar_compra_inversion(uuid, boolean) from anon, public;
grant execute on function editar_compra_inversion(uuid, boolean) to authenticated;
