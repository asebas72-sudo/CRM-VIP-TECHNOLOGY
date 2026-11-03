-- =====================================================================
-- CRM VIP TECHNOLOGY - Importación de compras desde factura DIAN
-- Todo se hace en una sola transacción: si algo falla, no queda nada
-- a medias (ni productos, ni stock, ni seriales).
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

-- Rol del usuario actual en una empresa (acceso total cuenta como admin)
create or replace function rol_en(p_empresa uuid)
returns rol_usuario language sql stable security definer set search_path = public as $$
  select case
    when tiene_acceso_total() then 'admin'::rol_usuario
    else (
      select m.rol from miembros_empresa m
      join perfiles p on p.usuario_id = m.usuario_id and p.activo
      where m.empresa_id = p_empresa and m.usuario_id = auth.uid()
    )
  end;
$$;

/*
  p_compra: {
    numero, cufe, fecha, subtotal, iva, total,
    proveedor_nit, proveedor_nombre
  }
  p_lineas: [{
    codigo,            -- código interno del producto (va en el QR)
    nombre, marca,     -- se usan solo si el producto es nuevo
    codigo_proveedor, descripcion,
    cantidad, costo_unitario, iva_porcentaje, iva_valor, total,
    maneja_serial, seriales: [..]
  }]
*/
create or replace function importar_compra(p_empresa uuid, p_compra jsonb, p_lineas jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_proveedor uuid;
  v_compra uuid;
  v_producto uuid;
  v_item uuid;
  v_linea jsonb;
  v_margen numeric;
  v_costo numeric;
  v_iva numeric;
  v_serial text;
begin
  if rol_en(p_empresa) is null or rol_en(p_empresa) not in ('admin', 'bodega') then
    raise exception 'Solo administradores o bodega pueden importar compras';
  end if;

  if jsonb_array_length(coalesce(p_lineas, '[]'::jsonb)) = 0 then
    raise exception 'La compra no tiene productos';
  end if;

  select margen_defecto into v_margen from empresas where id = p_empresa;

  -- Proveedor: se crea la primera vez que aparece su NIT
  insert into proveedores (empresa_id, nit, nombre)
  values (p_empresa, p_compra ->> 'proveedor_nit', p_compra ->> 'proveedor_nombre')
  on conflict (empresa_id, nit) do update set nombre = excluded.nombre
  returning id into v_proveedor;

  if exists (
    select 1 from compras
    where empresa_id = p_empresa and proveedor_id = v_proveedor and numero_factura = p_compra ->> 'numero'
  ) then
    raise exception 'La factura % de este proveedor ya fue importada', p_compra ->> 'numero';
  end if;

  insert into compras (empresa_id, proveedor_id, numero_factura, cufe, fecha, subtotal, iva, total, usuario_id)
  values (
    p_empresa, v_proveedor, p_compra ->> 'numero', nullif(p_compra ->> 'cufe', ''),
    (p_compra ->> 'fecha')::date,
    coalesce((p_compra ->> 'subtotal')::numeric, 0),
    coalesce((p_compra ->> 'iva')::numeric, 0),
    coalesce((p_compra ->> 'total')::numeric, 0),
    auth.uid()
  )
  returning id into v_compra;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_costo := (v_linea ->> 'costo_unitario')::numeric;
    v_iva := coalesce((v_linea ->> 'iva_porcentaje')::numeric, 0);

    -- Producto: se busca por código interno; si no existe se crea con
    -- un precio sugerido (costo + IVA + margen de la empresa, redondeado a 100).
    select id into v_producto from productos
    where empresa_id = p_empresa and codigo = v_linea ->> 'codigo';

    if v_producto is null then
      insert into productos (empresa_id, codigo, nombre, marca, iva_porcentaje, precio_venta, maneja_serial)
      values (
        p_empresa,
        v_linea ->> 'codigo',
        v_linea ->> 'nombre',
        nullif(v_linea ->> 'marca', ''),
        v_iva,
        ceil(v_costo * (1 + v_iva / 100) * (1 + v_margen / 100) / 100) * 100,
        coalesce((v_linea ->> 'maneja_serial')::boolean, false)
      )
      returning id into v_producto;
    end if;

    -- Recordar el código del proveedor para reconocerlo en la próxima factura
    if coalesce(v_linea ->> 'codigo_proveedor', '') <> '' then
      insert into producto_proveedor (empresa_id, proveedor_id, codigo_proveedor, producto_id)
      values (p_empresa, v_proveedor, v_linea ->> 'codigo_proveedor', v_producto)
      on conflict (empresa_id, proveedor_id, codigo_proveedor) do update set producto_id = excluded.producto_id;
    end if;

    insert into compra_items (
      empresa_id, compra_id, producto_id, codigo_proveedor, descripcion,
      cantidad, costo_unitario, iva_porcentaje, iva_valor, total
    ) values (
      p_empresa, v_compra, v_producto, v_linea ->> 'codigo_proveedor', v_linea ->> 'descripcion',
      (v_linea ->> 'cantidad')::numeric, v_costo, v_iva,
      coalesce((v_linea ->> 'iva_valor')::numeric, 0),
      coalesce((v_linea ->> 'total')::numeric, 0)
    )
    returning id into v_item;

    for v_serial in select jsonb_array_elements_text(coalesce(v_linea -> 'seriales', '[]'::jsonb)) loop
      insert into seriales (empresa_id, producto_id, serial, compra_item_id)
      values (p_empresa, v_producto, v_serial, v_item)
      on conflict (empresa_id, producto_id, serial) do nothing;
    end loop;

    -- Entrada al kardex: el trigger suma el stock y recalcula el costo promedio
    insert into movimientos_inventario (empresa_id, producto_id, tipo, cantidad, costo_unitario, compra_id)
    values (p_empresa, v_producto, 'entrada_compra', (v_linea ->> 'cantidad')::numeric, v_costo, v_compra);
  end loop;

  return v_compra;
end;
$$;

revoke execute on function importar_compra(uuid, jsonb, jsonb) from anon, public;
grant execute on function importar_compra(uuid, jsonb, jsonb) to authenticated;
revoke execute on function rol_en(uuid) from anon, public;
grant execute on function rol_en(uuid) to authenticated;

-- Permite actualizar la ruta del XML/PDF guardado
create policy "miembros actualizan archivos de compras" on storage.objects for update
  using (bucket_id = 'compras' and es_miembro(((storage.foldername(name))[1])::uuid));
