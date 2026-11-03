-- =====================================================================
-- CRM VIP TECHNOLOGY - Ventas, anulación de ventas y ajustes de inventario
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permisos por rol sobre el catálogo: solo admin y bodega modifican
-- productos y categorías (el vendedor solo consulta).
-- ---------------------------------------------------------------------
drop policy if exists "miembros editan" on productos;
create policy "admin y bodega editan" on productos for update
  using (rol_en(empresa_id) in ('admin', 'bodega'));

drop policy if exists "miembros crean" on productos;
create policy "admin y bodega crean" on productos for insert
  with check (rol_en(empresa_id) in ('admin', 'bodega'));

drop policy if exists "miembros crean" on categorias;
create policy "admin y bodega crean" on categorias for insert
  with check (rol_en(empresa_id) in ('admin', 'bodega'));

drop policy if exists "miembros editan" on categorias;
create policy "admin y bodega editan" on categorias for update
  using (rol_en(empresa_id) in ('admin', 'bodega'));

-- ---------------------------------------------------------------------
-- Registrar venta
--   p_venta: { forma_pago, recibido, notas,
--              cliente: { documento, nombre, telefono } | null }
--   p_items: [{ producto_id, cantidad, descuento, serial_ids: [uuid] }]
-- El precio se toma del producto (no del navegador). El descuento es en
-- pesos por línea. Devuelve el id de la venta.
-- ---------------------------------------------------------------------
create or replace function registrar_venta(p_empresa uuid, p_venta jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_rol rol_usuario := rol_en(p_empresa);
  v_venta uuid;
  v_consecutivo int;
  v_cliente uuid;
  v_item jsonb;
  v_prod record;
  v_cant numeric;
  v_desc numeric;
  v_total numeric;
  v_iva numeric;
  v_venta_item uuid;
  v_seriales uuid[];
  v_suma_total numeric := 0;
  v_suma_iva numeric := 0;
  v_suma_desc numeric := 0;
  v_forma forma_pago := coalesce(nullif(p_venta ->> 'forma_pago', ''), 'efectivo')::forma_pago;
  v_recibido numeric := nullif(p_venta ->> 'recibido', '')::numeric;
  v_doc text := nullif(trim(p_venta -> 'cliente' ->> 'documento'), '');
  v_nombre text := nullif(trim(p_venta -> 'cliente' ->> 'nombre'), '');
begin
  if v_rol is null or v_rol not in ('admin', 'vendedor') then
    raise exception 'Solo administradores o vendedores pueden registrar ventas';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  -- Cliente (opcional)
  if v_doc is not null then
    insert into clientes (empresa_id, documento, nombre, telefono)
    values (p_empresa, v_doc, coalesce(v_nombre, v_doc), nullif(trim(p_venta -> 'cliente' ->> 'telefono'), ''))
    on conflict (empresa_id, documento) do update
      set nombre = coalesce(v_nombre, clientes.nombre),
          telefono = coalesce(excluded.telefono, clientes.telefono)
    returning id into v_cliente;
  elsif v_nombre is not null then
    insert into clientes (empresa_id, nombre, telefono)
    values (p_empresa, v_nombre, nullif(trim(p_venta -> 'cliente' ->> 'telefono'), ''))
    returning id into v_cliente;
  end if;

  -- Consecutivo propio de cada empresa
  update empresas set siguiente_venta = siguiente_venta + 1
  where id = p_empresa
  returning siguiente_venta - 1 into v_consecutivo;

  insert into ventas (empresa_id, consecutivo, cliente_id, vendedor_id, forma_pago, recibido, notas)
  values (p_empresa, v_consecutivo, v_cliente, auth.uid(), v_forma, v_recibido, nullif(p_venta ->> 'notas', ''))
  returning id into v_venta;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_item ->> 'cantidad')::numeric;
    v_desc := greatest(coalesce((v_item ->> 'descuento')::numeric, 0), 0);
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cantidad inválida';
    end if;

    select id, nombre, precio_venta, iva_porcentaje, costo_promedio, stock, maneja_serial, activo
    into v_prod
    from productos
    where id = (v_item ->> 'producto_id')::uuid and empresa_id = p_empresa
    for update;

    if v_prod.id is null then
      raise exception 'Producto no encontrado en esta empresa';
    end if;
    if not v_prod.activo then
      raise exception 'El producto "%" está inactivo', v_prod.nombre;
    end if;
    if v_prod.stock < v_cant then
      raise exception 'Stock insuficiente de "%": hay % y se quieren vender %', v_prod.nombre, v_prod.stock, v_cant;
    end if;

    v_total := round(v_prod.precio_venta * v_cant - v_desc, 2);
    if v_total < 0 then
      raise exception 'El descuento de "%" supera el valor de la línea', v_prod.nombre;
    end if;
    v_iva := round(v_total - v_total / (1 + v_prod.iva_porcentaje / 100), 2);

    insert into venta_items (empresa_id, venta_id, producto_id, descripcion, cantidad, precio_unitario,
                             descuento, iva_porcentaje, total, costo_unitario)
    values (p_empresa, v_venta, v_prod.id, v_prod.nombre, v_cant, v_prod.precio_venta,
            v_desc, v_prod.iva_porcentaje, v_total, v_prod.costo_promedio)
    returning id into v_venta_item;

    -- Seriales
    if v_prod.maneja_serial then
      select coalesce(array_agg(x::uuid), '{}') into v_seriales
      from jsonb_array_elements_text(coalesce(v_item -> 'serial_ids', '[]'::jsonb)) x;

      if cardinality(v_seriales) <> v_cant then
        raise exception 'Seleccione % serial(es) para "%"', v_cant, v_prod.nombre;
      end if;

      update seriales set estado = 'vendido', venta_item_id = v_venta_item
      where id = any(v_seriales) and producto_id = v_prod.id and empresa_id = p_empresa and estado = 'disponible';

      if not found or (select count(*) from seriales where venta_item_id = v_venta_item) <> v_cant then
        raise exception 'Algún serial de "%" ya no está disponible', v_prod.nombre;
      end if;
    end if;

    insert into movimientos_inventario (empresa_id, producto_id, tipo, cantidad, costo_unitario, venta_id)
    values (p_empresa, v_prod.id, 'salida_venta', v_cant, v_prod.costo_promedio, v_venta);

    v_suma_total := v_suma_total + v_total;
    v_suma_iva := v_suma_iva + v_iva;
    v_suma_desc := v_suma_desc + v_desc;
  end loop;

  if v_forma = 'efectivo' and v_recibido is not null and v_recibido < v_suma_total then
    raise exception 'El valor recibido es menor que el total';
  end if;

  update ventas set
    subtotal = v_suma_total - v_suma_iva,
    iva = v_suma_iva,
    descuento = v_suma_desc,
    total = v_suma_total,
    cambio = case when v_recibido is not null then v_recibido - v_suma_total end
  where id = v_venta;

  return v_venta;
end;
$$;

-- ---------------------------------------------------------------------
-- Anular venta: devuelve el stock y libera los seriales
-- ---------------------------------------------------------------------
create or replace function anular_venta(p_venta uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_venta record;
begin
  select id, empresa_id, estado into v_venta from ventas where id = p_venta for update;
  if v_venta.id is null then
    raise exception 'La venta no existe';
  end if;
  if not es_admin(v_venta.empresa_id) then
    raise exception 'Solo un administrador puede anular ventas';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'La venta ya está anulada';
  end if;

  insert into movimientos_inventario (empresa_id, producto_id, tipo, cantidad, costo_unitario, venta_id, nota)
  select empresa_id, producto_id, 'anulacion_venta', cantidad, costo_unitario, venta_id, p_motivo
  from venta_items where venta_id = p_venta;

  update seriales set estado = 'disponible', venta_item_id = null
  where venta_item_id in (select id from venta_items where venta_id = p_venta);

  update ventas set estado = 'anulada',
    notas = trim(coalesce(notas, '') || ' [Anulada: ' || coalesce(nullif(p_motivo, ''), 'sin motivo') || ']')
  where id = p_venta;
end;
$$;

-- ---------------------------------------------------------------------
-- Ajuste manual de inventario (conteo físico, daño, pérdida, etc.)
-- ---------------------------------------------------------------------
create or replace function ajustar_inventario(p_producto uuid, p_tipo tipo_movimiento, p_cantidad numeric, p_nota text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_prod record;
begin
  select id, empresa_id, stock, costo_promedio, nombre into v_prod from productos where id = p_producto for update;
  if v_prod.id is null then
    raise exception 'Producto no encontrado';
  end if;
  if rol_en(v_prod.empresa_id) is null or rol_en(v_prod.empresa_id) not in ('admin', 'bodega') then
    raise exception 'Solo administradores o bodega pueden ajustar inventario';
  end if;
  if p_tipo not in ('ajuste_entrada', 'ajuste_salida') then
    raise exception 'Tipo de ajuste inválido';
  end if;
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;
  if p_tipo = 'ajuste_salida' and v_prod.stock < p_cantidad then
    raise exception 'No hay suficiente stock de "%" (hay %)', v_prod.nombre, v_prod.stock;
  end if;
  if coalesce(trim(p_nota), '') = '' then
    raise exception 'Escriba el motivo del ajuste';
  end if;

  insert into movimientos_inventario (empresa_id, producto_id, tipo, cantidad, costo_unitario, nota)
  values (v_prod.empresa_id, p_producto, p_tipo, p_cantidad, v_prod.costo_promedio, p_nota);
end;
$$;

revoke execute on function registrar_venta(uuid, jsonb, jsonb) from anon, public;
revoke execute on function anular_venta(uuid, text) from anon, public;
revoke execute on function ajustar_inventario(uuid, tipo_movimiento, numeric, text) from anon, public;
grant execute on function registrar_venta(uuid, jsonb, jsonb) to authenticated;
grant execute on function anular_venta(uuid, text) to authenticated;
grant execute on function ajustar_inventario(uuid, tipo_movimiento, numeric, text) to authenticated;
