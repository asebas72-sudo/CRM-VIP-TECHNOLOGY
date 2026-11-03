-- =====================================================================
-- CRM VIP TECHNOLOGY - Eliminar una compra importada por error
--
-- Revierte todo lo que hizo importar_compra:
--   * resta del stock las unidades que entraron con esa factura
--   * borra sus seriales y sus movimientos del kardex
--   * recalcula costo promedio y último costo con las compras restantes
--   * borra los productos que solo existían por esa factura (sin otras
--     compras ni ventas), para poder volver a importarla limpia
-- No se permite si ya se vendió algo de esa compra.
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

create or replace function eliminar_compra(p_compra uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_empresa uuid;
  v_numero text;
  v_item record;
  v_productos uuid[];
begin
  select empresa_id, numero_factura into v_empresa, v_numero from compras where id = p_compra;
  if v_empresa is null then
    raise exception 'La compra no existe';
  end if;
  if not es_admin(v_empresa) then
    raise exception 'Solo un administrador puede eliminar compras';
  end if;

  -- Seriales de esta compra que ya se vendieron
  if exists (
    select 1 from seriales s join compra_items ci on ci.id = s.compra_item_id
    where ci.compra_id = p_compra and s.estado <> 'disponible'
  ) then
    raise exception 'No se puede eliminar: hay seriales de esta compra que ya se vendieron o dieron de baja';
  end if;

  -- El stock actual debe alcanzar para retirar lo que entró
  for v_item in
    select ci.producto_id, sum(ci.cantidad) as cantidad, p.stock, p.nombre
    from compra_items ci join productos p on p.id = ci.producto_id
    where ci.compra_id = p_compra
    group by ci.producto_id, p.stock, p.nombre
  loop
    if v_item.stock < v_item.cantidad then
      raise exception 'No se puede eliminar: del producto "%" ya salieron unidades (stock % y la compra trajo %)',
        v_item.nombre, v_item.stock, v_item.cantidad;
    end if;
  end loop;

  select array_agg(distinct producto_id) into v_productos from compra_items where compra_id = p_compra;

  -- Retirar stock
  update productos p set stock = p.stock - x.cantidad, actualizado_en = now()
  from (select producto_id, sum(cantidad) as cantidad from compra_items where compra_id = p_compra group by producto_id) x
  where p.id = x.producto_id;

  delete from seriales where compra_item_id in (select id from compra_items where compra_id = p_compra);
  delete from movimientos_inventario where compra_id = p_compra;
  delete from compras where id = p_compra; -- borra compra_items en cascada

  -- Recalcular costos con las entradas que quedan
  update productos p set
    costo_promedio = coalesce((
      select round(sum(m.cantidad * m.costo_unitario) / nullif(sum(m.cantidad), 0), 2)
      from movimientos_inventario m where m.producto_id = p.id and m.tipo = 'entrada_compra'
    ), 0),
    ultimo_costo = coalesce((
      select m.costo_unitario from movimientos_inventario m
      where m.producto_id = p.id and m.tipo = 'entrada_compra'
      order by m.fecha desc limit 1
    ), 0)
  where p.id = any(v_productos);

  -- Productos que quedaron sin historia: se eliminan
  delete from productos p
  where p.id = any(v_productos)
    and p.stock = 0
    and not exists (select 1 from compra_items ci where ci.producto_id = p.id)
    and not exists (select 1 from venta_items vi where vi.producto_id = p.id)
    and not exists (select 1 from movimientos_inventario m where m.producto_id = p.id);

  return v_numero;
end;
$$;

revoke execute on function eliminar_compra(uuid) from anon, public;
grant execute on function eliminar_compra(uuid) to authenticated;

-- Permite borrar el XML/PDF de una compra eliminada
create policy "admin borra archivos de compras" on storage.objects for delete
  using (bucket_id = 'compras' and es_admin(((storage.foldername(name))[1])::uuid));
