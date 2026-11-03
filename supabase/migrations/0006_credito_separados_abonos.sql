-- =====================================================================
-- CRM VIP TECHNOLOGY - Crédito, separados (abonos) y cliente obligatorio
--
-- Tipos de venta:
--   contado  : se paga todo en el momento.
--   credito  : el cliente se lleva el producto y paga después (con o sin
--              cuota inicial). Queda saldo en cartera.
--   separado : el cliente va abonando; el producto queda apartado (sale
--              del stock disponible) y se entrega cuando termina de pagar.
-- Toda venta tiene cliente: si no se indica, va a "CONSUMIDOR FINAL".
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

alter table ventas
  add column if not exists tipo text not null default 'contado' check (tipo in ('contado', 'credito', 'separado')),
  add column if not exists abonado numeric(14,2) not null default 0,
  add column if not exists saldo numeric(14,2) not null default 0,
  add column if not exists fecha_vencimiento date,
  add column if not exists entregada boolean not null default true,
  add column if not exists entregada_en timestamptz;

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  venta_id uuid not null references ventas(id) on delete cascade,
  valor numeric(14,2) not null check (valor > 0),
  forma_pago forma_pago not null default 'efectivo',
  nota text,
  usuario_id uuid references auth.users(id) default auth.uid(),
  fecha timestamptz not null default now()
);
create index if not exists pagos_venta_idx on pagos (venta_id);

alter table pagos enable row level security;
drop policy if exists "miembros leen" on pagos;
create policy "miembros leen" on pagos for select using (es_miembro(empresa_id));
-- Los pagos solo se crean con las funciones de abajo

-- Ventas anteriores: quedaron pagadas de contado
update ventas set abonado = total, saldo = 0 where tipo = 'contado' and abonado = 0;
insert into pagos (empresa_id, venta_id, valor, forma_pago, usuario_id, fecha)
select v.empresa_id, v.id, v.total, v.forma_pago, v.vendedor_id, v.fecha
from ventas v
where v.total > 0 and not exists (select 1 from pagos p where p.venta_id = v.id);

-- ---------------------------------------------------------------------
-- Cliente genérico por empresa
-- ---------------------------------------------------------------------
create or replace function cliente_generico(p_empresa uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into clientes (empresa_id, documento, nombre)
  values (p_empresa, '222222222222', 'CONSUMIDOR FINAL')
  on conflict (empresa_id, documento) do update set documento = excluded.documento
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Registrar venta (reemplaza la versión de la migración 0005)
--   p_venta: { tipo, forma_pago, abono_inicial, fecha_vencimiento, notas,
--              cliente_id | cliente: { documento, nombre, telefono } }
--   p_items: [{ producto_id, cantidad, descuento, serial_ids: [uuid] }]
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
    insert into movimientos_inventario (empresa_id, producto_id, tipo, cantidad, costo_unitario, venta_id)
    values (p_empresa, v_prod.id, 'salida_venta', v_cant, v_prod.costo_promedio, v_venta);

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

-- ---------------------------------------------------------------------
-- Registrar abono a una venta a crédito o separada
-- ---------------------------------------------------------------------
create or replace function registrar_abono(p_venta uuid, p_valor numeric, p_forma forma_pago, p_nota text)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_rol rol_usuario;
begin
  select id, empresa_id, estado, saldo into v from ventas where id = p_venta for update;
  if v.id is null then
    raise exception 'La venta no existe';
  end if;
  v_rol := rol_en(v.empresa_id);
  if v_rol is null or v_rol not in ('admin', 'vendedor') then
    raise exception 'Solo administradores o vendedores pueden registrar abonos';
  end if;
  if v.estado = 'anulada' then
    raise exception 'La venta está anulada';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'El valor del abono debe ser mayor que cero';
  end if;
  if p_valor > v.saldo then
    raise exception 'El abono (%) supera el saldo pendiente (%)', p_valor, v.saldo;
  end if;

  insert into pagos (empresa_id, venta_id, valor, forma_pago, nota)
  values (v.empresa_id, p_venta, p_valor, p_forma, nullif(trim(p_nota), ''));

  update ventas set abonado = abonado + p_valor, saldo = saldo - p_valor where id = p_venta;
  return v.saldo - p_valor;
end;
$$;

-- ---------------------------------------------------------------------
-- Entregar un separado ya pagado
-- ---------------------------------------------------------------------
create or replace function entregar_venta(p_venta uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_rol rol_usuario;
begin
  select id, empresa_id, estado, saldo, entregada into v from ventas where id = p_venta for update;
  if v.id is null then
    raise exception 'La venta no existe';
  end if;
  v_rol := rol_en(v.empresa_id);
  if v_rol is null or v_rol not in ('admin', 'vendedor', 'bodega') then
    raise exception 'Sin permiso para entregar';
  end if;
  if v.estado = 'anulada' then
    raise exception 'La venta está anulada';
  end if;
  if v.saldo > 0 then
    raise exception 'No se puede entregar: tiene saldo pendiente';
  end if;
  update ventas set entregada = true, entregada_en = now() where id = p_venta;
end;
$$;

revoke execute on function cliente_generico(uuid) from anon, public;
revoke execute on function registrar_abono(uuid, numeric, forma_pago, text) from anon, public;
revoke execute on function entregar_venta(uuid) from anon, public;
grant execute on function cliente_generico(uuid) to authenticated;
grant execute on function registrar_abono(uuid, numeric, forma_pago, text) to authenticated;
grant execute on function entregar_venta(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Anular venta (reemplaza la de 0005): además saca el saldo de cartera.
-- Los pagos recibidos quedan registrados para devolverlos al cliente.
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

  update ventas set estado = 'anulada', saldo = 0,
    notas = trim(coalesce(notas, '') || ' [Anulada: ' || coalesce(nullif(p_motivo, ''), 'sin motivo') || ']')
  where id = p_venta;
end;
$$;
