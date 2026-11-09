-- =====================================================================
-- CRM VIP TECHNOLOGY - Servicios que se venden y Portafolio público
--
-- * Los servicios son filas de "productos" con es_servicio = true: se
--   venden en el punto de venta y salen en tirillas e informes, pero no
--   manejan stock ni aparecen en inventario.
-- * El portafolio público solo lee lo permitido mediante la función
--   portafolio_publico: nunca costos, proveedores ni stock exacto.
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

alter table productos
  add column if not exists es_servicio boolean not null default false,
  add column if not exists publicar_portafolio boolean not null default false,
  add column if not exists descripcion_comercial text,
  add column if not exists foto_path text,
  add column if not exists etiqueta_portafolio text check (etiqueta_portafolio in ('oferta', 'nuevo'));

create table if not exists portafolio_config (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  activo boolean not null default true,
  titulo text,
  mensaje text,
  whatsapp text,
  correo text,
  direccion text,
  facebook text,
  instagram text,
  color text not null default '#1d4ed8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  logo_path text,
  mostrar_precios boolean not null default true,
  agotados text not null default 'por_pedido' check (agotados in ('por_pedido', 'ocultar')),
  actualizado_en timestamptz not null default now()
);

alter table portafolio_config enable row level security;
drop policy if exists "admin ve portafolio" on portafolio_config;
create policy "admin ve portafolio" on portafolio_config for select using (es_admin(empresa_id));
drop policy if exists "admin crea portafolio" on portafolio_config;
create policy "admin crea portafolio" on portafolio_config for insert with check (es_admin(empresa_id));
drop policy if exists "admin edita portafolio" on portafolio_config;
create policy "admin edita portafolio" on portafolio_config for update using (es_admin(empresa_id)) with check (es_admin(empresa_id));

-- Fotos y logos: se ven públicamente, solo el administrador de la empresa las cambia
insert into storage.buckets (id, name, public) values ('portafolio', 'portafolio', true)
on conflict (id) do update set public = true;

drop policy if exists "admin ve fotos portafolio" on storage.objects;
create policy "admin ve fotos portafolio" on storage.objects for select
  using (bucket_id = 'portafolio' and es_admin(((storage.foldername(name))[1])::uuid));
drop policy if exists "admin sube fotos portafolio" on storage.objects;
create policy "admin sube fotos portafolio" on storage.objects for insert
  with check (bucket_id = 'portafolio' and es_admin(((storage.foldername(name))[1])::uuid));
drop policy if exists "admin cambia fotos portafolio" on storage.objects;
create policy "admin cambia fotos portafolio" on storage.objects for update
  using (bucket_id = 'portafolio' and es_admin(((storage.foldername(name))[1])::uuid));
drop policy if exists "admin borra fotos portafolio" on storage.objects;
create policy "admin borra fotos portafolio" on storage.objects for delete
  using (bucket_id = 'portafolio' and es_admin(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------
-- Datos públicos del portafolio: únicamente lo que se puede mostrar
-- ---------------------------------------------------------------------
create or replace function portafolio_publico(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'empresa', e.nombre,
    'titulo', c.titulo,
    'mensaje', c.mensaje,
    'whatsapp', c.whatsapp,
    'correo', c.correo,
    'direccion', c.direccion,
    'facebook', c.facebook,
    'instagram', c.instagram,
    'color', c.color,
    'logo_path', c.logo_path,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nombre', p.nombre,
        'descripcion', p.descripcion_comercial,
        'foto_path', p.foto_path,
        'etiqueta', p.etiqueta_portafolio,
        'categoria', cat.nombre,
        'es_servicio', p.es_servicio,
        'precio', case when c.mostrar_precios then p.precio_venta end,
        'disponibilidad', case
          when p.es_servicio then 'disponible'
          when p.stock <= 0 then 'por_pedido'
          when p.stock <= 2 then 'pocas'
          else 'disponible' end
      ) order by p.nombre)
      from productos p
      left join categorias cat on cat.id = p.categoria_id
      where p.empresa_id = c.empresa_id
        and p.activo
        and p.publicar_portafolio
        and (p.es_servicio or p.stock > 0 or c.agotados = 'por_pedido')
    ), '[]'::jsonb)
  )
  from portafolio_config c
  join empresas e on e.id = c.empresa_id
  where c.slug = lower(p_slug) and c.activo;
$$;

revoke execute on function portafolio_publico(text) from public;
grant execute on function portafolio_publico(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Ventas: los servicios no validan ni mueven inventario
-- (misma función de la migración 0006 con esa única diferencia)
-- ---------------------------------------------------------------------
create or replace function registrar_venta(p_empresa uuid, p_venta jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_rol rol_usuario := rol_en(p_empresa);
  v_tipo text := coalesce(nullif(p_venta ->> 'tipo', ''), 'contado');
  v_forma forma_pago := coalesce(nullif(p_venta ->> 'forma_pago', ''), 'efectivo')::forma_pago;
  v_abono numeric := greatest(coalesce(nullif(p_venta ->> 'abono_inicial', '')::numeric, 0), 0);
  v_doc text := nullif(trim(p_venta -> 'cliente' ->> 'documento'), '');
  v_nombre text := nullif(trim(p_venta -> 'cliente' ->> 'nombre'), '');
  v_tel text := nullif(trim(p_venta -> 'cliente' ->> 'telefono'), '');
  v_generico uuid;
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
begin
  if v_rol is null or v_rol not in ('admin', 'vendedor') then
    raise exception 'Solo administradores o vendedores pueden registrar ventas';
  end if;
  if v_tipo not in ('contado', 'credito', 'separado') then
    raise exception 'Tipo de venta inválido';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  -- Cliente: uno existente, uno nuevo o el genérico
  v_generico := cliente_generico(p_empresa);
  if nullif(p_venta ->> 'cliente_id', '') is not null then
    select id into v_cliente from clientes
    where id = (p_venta ->> 'cliente_id')::uuid and empresa_id = p_empresa;
    if v_cliente is null then
      raise exception 'Cliente no encontrado';
    end if;
  elsif v_doc is not null then
    if v_nombre is null then
      raise exception 'Escriba el nombre del cliente';
    end if;
    insert into clientes (empresa_id, documento, nombre, telefono)
    values (p_empresa, v_doc, v_nombre, v_tel)
    on conflict (empresa_id, documento) do update
      set nombre = excluded.nombre, telefono = coalesce(excluded.telefono, clientes.telefono)
    returning id into v_cliente;
  else
    v_cliente := v_generico;
  end if;

  if v_tipo <> 'contado' and v_cliente = v_generico then
    raise exception 'Las ventas a crédito o por separado necesitan un cliente identificado (no consumidor final)';
  end if;

  update empresas set siguiente_venta = siguiente_venta + 1
  where id = p_empresa
  returning siguiente_venta - 1 into v_consecutivo;

  insert into ventas (empresa_id, consecutivo, cliente_id, vendedor_id, forma_pago, notas, tipo,
                      fecha_vencimiento, entregada)
  values (p_empresa, v_consecutivo, v_cliente, auth.uid(), v_forma, nullif(p_venta ->> 'notas', ''), v_tipo,
          nullif(p_venta ->> 'fecha_vencimiento', '')::date, v_tipo <> 'separado')
  returning id into v_venta;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_item ->> 'cantidad')::numeric;
    v_desc := greatest(coalesce((v_item ->> 'descuento')::numeric, 0), 0);
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cantidad inválida';
    end if;

    select id, nombre, precio_venta, iva_porcentaje, costo_promedio, stock, maneja_serial, activo, es_servicio
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
    if not v_prod.es_servicio and v_prod.stock < v_cant then
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

    if v_prod.maneja_serial then
      select coalesce(array_agg(x::uuid), '{}') into v_seriales
      from jsonb_array_elements_text(coalesce(v_item -> 'serial_ids', '[]'::jsonb)) x;

      if cardinality(v_seriales) <> v_cant then
        raise exception 'Seleccione % serial(es) para "%"', v_cant, v_prod.nombre;
      end if;

      update seriales set estado = 'vendido', venta_item_id = v_venta_item
      where id = any(v_seriales) and producto_id = v_prod.id and empresa_id = p_empresa and estado = 'disponible';

      if (select count(*) from seriales where venta_item_id = v_venta_item) <> v_cant then
        raise exception 'Algún serial de "%" ya no está disponible', v_prod.nombre;
      end if;
    end if;

    -- Sale del stock también en separados: queda apartado para el cliente
    if not v_prod.es_servicio then
      insert into movimientos_inventario (empresa_id, producto_id, tipo, cantidad, costo_unitario, venta_id)
      values (p_empresa, v_prod.id, 'salida_venta', v_cant, v_prod.costo_promedio, v_venta);
    end if;

    v_suma_total := v_suma_total + v_total;
    v_suma_iva := v_suma_iva + v_iva;
    v_suma_desc := v_suma_desc + v_desc;
  end loop;

  -- Pago: contado = todo; crédito/separado = abono inicial (puede ser 0)
  if v_tipo = 'contado' then
    v_abono := v_suma_total;
  elsif v_abono > v_suma_total then
    raise exception 'El abono inicial supera el total de la venta';
  elsif v_tipo = 'separado' and v_abono = v_suma_total then
    raise exception 'Si paga todo, registre la venta de contado';
  end if;

  if v_abono > 0 then
    insert into pagos (empresa_id, venta_id, valor, forma_pago, nota)
    values (p_empresa, v_venta, v_abono, v_forma, case when v_tipo = 'contado' then null else 'Abono inicial' end);
  end if;

  update ventas set
    subtotal = v_suma_total - v_suma_iva,
    iva = v_suma_iva,
    descuento = v_suma_desc,
    total = v_suma_total,
    abonado = v_abono,
    saldo = v_suma_total - v_abono,
    entregada = (v_tipo <> 'separado') or (v_suma_total - v_abono = 0),
    entregada_en = case when v_tipo <> 'separado' then now() end
  where id = v_venta;

  return v_venta;
end;
$$;

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
  from venta_items where venta_id = p_venta
    and producto_id not in (select id from productos where es_servicio);

  update seriales set estado = 'disponible', venta_item_id = null
  where venta_item_id in (select id from venta_items where venta_id = p_venta);

  update ventas set estado = 'anulada', saldo = 0,
    notas = trim(coalesce(notas, '') || ' [Anulada: ' || coalesce(nullif(p_motivo, ''), 'sin motivo') || ']')
  where id = p_venta;
end;
$$;
