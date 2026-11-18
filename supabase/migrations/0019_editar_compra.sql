-- =====================================================================
-- CRM VIP TECHNOLOGY - Editar una compra (solo superadmin)
--
-- Permite corregir una compra ya cargada:
--   * proveedor, número de factura y fecha
--   * cantidad, costo unitario (sin IVA) e IVA de cada línea
--   * quitar líneas
-- El inventario se ajusta solo con la diferencia, el kardex de la compra
-- se actualiza y se recalculan costo promedio y último costo.
-- Las líneas con seriales no permiten cambiar cantidad ni quitarse
-- (solo costo e IVA).
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

create or replace function editar_compra(p_compra uuid, p_cabecera jsonb, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_empresa uuid;
  v_linea jsonb;
  v_item record;
  v_cantidad numeric;
  v_costo numeric;
  v_iva numeric;
  v_quitar boolean;
  v_dif numeric;
  v_stock numeric;
  v_productos uuid[];
  v_prod uuid;
  v_mov uuid;
  v_suma_cant numeric;
  v_suma_costo numeric;
begin
  if not tiene_acceso_total() then
    raise exception 'Solo un superadmin puede modificar compras';
  end if;

  select empresa_id into v_empresa from compras where id = p_compra for update;
  if v_empresa is null then
    raise exception 'La compra no existe';
  end if;

  -- Productos involucrados antes del cambio (para recalcular costos)
  select array_agg(distinct producto_id) into v_productos from compra_items where compra_id = p_compra;

  -- Cabecera
  if not exists (select 1 from proveedores where id = (p_cabecera ->> 'proveedor_id')::uuid and empresa_id = v_empresa) then
    raise exception 'El proveedor no pertenece a esta empresa';
  end if;
  if coalesce(trim(p_cabecera ->> 'numero_factura'), '') = '' then
    raise exception 'El número de factura es obligatorio';
  end if;
  if exists (
    select 1 from compras
    where empresa_id = v_empresa and id <> p_compra
      and proveedor_id = (p_cabecera ->> 'proveedor_id')::uuid
      and numero_factura = trim(p_cabecera ->> 'numero_factura')
  ) then
    raise exception 'Ya existe otra compra de ese proveedor con el número %', trim(p_cabecera ->> 'numero_factura');
  end if;

  update compras set
    proveedor_id = (p_cabecera ->> 'proveedor_id')::uuid,
    numero_factura = trim(p_cabecera ->> 'numero_factura'),
    fecha = (p_cabecera ->> 'fecha')::date
  where id = p_compra;

  -- Líneas
  for v_linea in select * from jsonb_array_elements(p_items) loop
    select ci.*, p.nombre, p.stock as stock_producto,
           exists (select 1 from seriales s where s.compra_item_id = ci.id) as tiene_seriales
      into v_item
      from compra_items ci join productos p on p.id = ci.producto_id
     where ci.id = (v_linea ->> 'id')::uuid and ci.compra_id = p_compra;
    if not found then
      raise exception 'Una de las líneas no pertenece a esta compra';
    end if;

    v_quitar := coalesce((v_linea ->> 'quitar')::boolean, false);
    v_cantidad := case when v_quitar then 0 else (v_linea ->> 'cantidad')::numeric end;
    v_costo := (v_linea ->> 'costo_unitario')::numeric;
    v_iva := (v_linea ->> 'iva_porcentaje')::numeric;

    if v_cantidad is null or v_cantidad < 0 or (not v_quitar and v_cantidad = 0) then
      raise exception 'Cantidad inválida en "%" (para quitarla use Quitar)', v_item.nombre;
    end if;
    if v_costo is null or v_costo < 0 or v_iva is null or v_iva < 0 then
      raise exception 'Costo o IVA inválido en "%"', v_item.nombre;
    end if;

    v_dif := v_cantidad - v_item.cantidad;
    if v_dif <> 0 and v_item.tiene_seriales then
      raise exception '"%" tiene seriales: no se puede cambiar su cantidad ni quitarla (solo el costo)', v_item.nombre;
    end if;

    if v_dif <> 0 then
      select stock into v_stock from productos where id = v_item.producto_id for update;
      if v_stock + v_dif < 0 then
        raise exception 'No se puede: de "%" ya salieron unidades (stock %, se quieren retirar %)',
          v_item.nombre, v_stock, -v_dif;
      end if;
      update productos set stock = stock + v_dif, actualizado_en = now() where id = v_item.producto_id;
    end if;

    if v_quitar then
      delete from compra_items where id = v_item.id;
    else
      update compra_items set
        cantidad = v_cantidad,
        costo_unitario = v_costo,
        iva_porcentaje = v_iva,
        iva_valor = round(v_cantidad * v_costo * v_iva / 100, 2),
        total = round(v_cantidad * v_costo * (1 + v_iva / 100), 2)
      where id = v_item.id;
    end if;
  end loop;

  if not exists (select 1 from compra_items where compra_id = p_compra) then
    raise exception 'La compra debe quedar con al menos un producto. Si sobra completa, elimínela.';
  end if;

  -- Totales de la compra
  update compras c set
    subtotal = x.subtotal, iva = x.iva, total = x.total
  from (
    select coalesce(sum(round(cantidad * costo_unitario, 2)), 0) as subtotal,
           coalesce(sum(iva_valor), 0) as iva,
           coalesce(sum(total), 0) as total
    from compra_items where compra_id = p_compra
  ) x
  where c.id = p_compra;

  -- Kardex: una entrada por producto con lo que quedó en la compra
  -- (se actualiza la fila existente; el trigger solo actúa al insertar)
  foreach v_prod in array v_productos loop
    select sum(cantidad), sum(cantidad * costo_unitario) into v_suma_cant, v_suma_costo
      from compra_items where compra_id = p_compra and producto_id = v_prod;

    select id into v_mov from movimientos_inventario
     where compra_id = p_compra and producto_id = v_prod and tipo = 'entrada_compra'
     order by fecha limit 1;

    if coalesce(v_suma_cant, 0) = 0 then
      delete from movimientos_inventario
       where compra_id = p_compra and producto_id = v_prod and tipo = 'entrada_compra';
    elsif v_mov is not null then
      update movimientos_inventario set
        cantidad = v_suma_cant,
        costo_unitario = round(v_suma_costo / v_suma_cant, 2)
      where id = v_mov;
      delete from movimientos_inventario
       where compra_id = p_compra and producto_id = v_prod and tipo = 'entrada_compra' and id <> v_mov;
    end if;
  end loop;

  -- Recalcular costos con las entradas de compra
  update productos p set
    costo_promedio = coalesce((
      select round(sum(m.cantidad * m.costo_unitario) / nullif(sum(m.cantidad), 0), 2)
      from movimientos_inventario m where m.producto_id = p.id and m.tipo = 'entrada_compra'
    ), 0),
    ultimo_costo = coalesce((
      select m.costo_unitario from movimientos_inventario m
      where m.producto_id = p.id and m.tipo = 'entrada_compra'
      order by m.fecha desc limit 1
    ), 0),
    actualizado_en = now()
  where p.id = any(v_productos);
end;
$$;

revoke execute on function editar_compra(uuid, jsonb, jsonb) from anon, public;
grant execute on function editar_compra(uuid, jsonb, jsonb) to authenticated;
