-- =====================================================================
-- CRM VIP TECHNOLOGY - Esquema inicial
-- Multiempresa: toda tabla de negocio lleva empresa_id y se protege con
-- Row Level Security (RLS) para que cada usuario vea solo sus empresas.
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type rol_usuario as enum ('admin', 'bodega', 'vendedor');
create type tipo_movimiento as enum ('entrada_compra', 'salida_venta', 'ajuste_entrada', 'ajuste_salida', 'anulacion_venta');
create type estado_serial as enum ('disponible', 'vendido', 'baja');
create type estado_venta as enum ('pagada', 'anulada');
create type forma_pago as enum ('efectivo', 'tarjeta', 'transferencia', 'mixto');

-- ---------------------------------------------------------------------
-- Empresas y usuarios
-- ---------------------------------------------------------------------
create table empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nit text,
  direccion text,
  telefono text,
  ciudad text,
  encabezado_tirilla text,
  pie_tirilla text default 'Gracias por su compra',
  ancho_tirilla_mm int not null default 80 check (ancho_tirilla_mm in (58, 80)),
  margen_defecto numeric(6,2) not null default 30,
  siguiente_venta int not null default 1,
  creado_en timestamptz not null default now()
);

create table miembros_empresa (
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol rol_usuario not null default 'vendedor',
  nombre text,
  creado_en timestamptz not null default now(),
  primary key (empresa_id, usuario_id)
);

-- Funciones de ayuda para las políticas (security definer evita recursión en RLS)
create or replace function es_miembro(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from miembros_empresa
    where empresa_id = p_empresa and usuario_id = auth.uid()
  );
$$;

create or replace function es_admin(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from miembros_empresa
    where empresa_id = p_empresa and usuario_id = auth.uid() and rol = 'admin'
  );
$$;

-- Crea una empresa y deja al usuario actual como administrador
create or replace function crear_empresa(p_nombre text, p_nit text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión';
  end if;
  insert into empresas (nombre, nit) values (p_nombre, p_nit) returning id into v_id;
  insert into miembros_empresa (empresa_id, usuario_id, rol) values (v_id, auth.uid(), 'admin');
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create table proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nit text not null,
  nombre text not null,
  telefono text,
  correo text,
  direccion text,
  creado_en timestamptz not null default now(),
  unique (empresa_id, nit)
);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  unique (empresa_id, nombre)
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo text not null,                      -- código interno, va en el QR
  nombre text not null,
  marca text,
  categoria_id uuid references categorias(id) on delete set null,
  ultimo_costo numeric(14,2) not null default 0,     -- sin IVA
  costo_promedio numeric(14,2) not null default 0,   -- sin IVA
  iva_porcentaje numeric(5,2) not null default 19,
  precio_venta numeric(14,2) not null default 0,     -- IVA incluido
  maneja_serial boolean not null default false,
  stock numeric(14,2) not null default 0,
  stock_minimo numeric(14,2) not null default 0,
  ubicacion text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, codigo)
);
create index productos_nombre_idx on productos (empresa_id, nombre);

-- Relaciona el código que usa cada proveedor con nuestro producto,
-- para que al importar una nueva factura el producto se reconozca solo.
create table producto_proveedor (
  empresa_id uuid not null references empresas(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  codigo_proveedor text not null,
  producto_id uuid not null references productos(id) on delete cascade,
  primary key (empresa_id, proveedor_id, codigo_proveedor)
);

-- ---------------------------------------------------------------------
-- Compras (importadas desde XML DIAN)
-- ---------------------------------------------------------------------
create table compras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  proveedor_id uuid not null references proveedores(id),
  numero_factura text not null,
  cufe text,
  fecha date not null,
  subtotal numeric(14,2) not null default 0,
  iva numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  xml_path text,
  pdf_path text,
  usuario_id uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  unique (empresa_id, proveedor_id, numero_factura)
);

create table compra_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  compra_id uuid not null references compras(id) on delete cascade,
  producto_id uuid not null references productos(id),
  codigo_proveedor text,
  descripcion text not null,
  cantidad numeric(14,2) not null,
  costo_unitario numeric(14,2) not null,     -- sin IVA
  iva_porcentaje numeric(5,2) not null default 0,
  iva_valor numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0     -- con IVA
);

-- ---------------------------------------------------------------------
-- Clientes y ventas
-- ---------------------------------------------------------------------
create table clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  documento text,
  nombre text not null,
  telefono text,
  correo text,
  creado_en timestamptz not null default now(),
  unique (empresa_id, documento)
);

create table ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  consecutivo int not null,
  cliente_id uuid references clientes(id),
  vendedor_id uuid references auth.users(id),
  fecha timestamptz not null default now(),
  subtotal numeric(14,2) not null default 0,
  descuento numeric(14,2) not null default 0,
  iva numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  forma_pago forma_pago not null default 'efectivo',
  recibido numeric(14,2),
  cambio numeric(14,2),
  estado estado_venta not null default 'pagada',
  notas text,
  unique (empresa_id, consecutivo)
);

create table venta_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  venta_id uuid not null references ventas(id) on delete cascade,
  producto_id uuid not null references productos(id),
  descripcion text not null,
  cantidad numeric(14,2) not null,
  precio_unitario numeric(14,2) not null,    -- IVA incluido
  descuento numeric(14,2) not null default 0,
  iva_porcentaje numeric(5,2) not null default 0,
  total numeric(14,2) not null,
  costo_unitario numeric(14,2) not null default 0   -- para calcular utilidad
);

-- Seriales por unidad (vienen en la factura de compra; se eligen al vender)
create table seriales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  serial text not null,
  estado estado_serial not null default 'disponible',
  compra_item_id uuid references compra_items(id) on delete set null,
  venta_item_id uuid references venta_items(id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (empresa_id, producto_id, serial)
);

-- ---------------------------------------------------------------------
-- Kardex: cada entrada/salida de inventario. El stock del producto se
-- actualiza automáticamente con el trigger de abajo.
-- ---------------------------------------------------------------------
create table movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  tipo tipo_movimiento not null,
  cantidad numeric(14,2) not null check (cantidad > 0),
  costo_unitario numeric(14,2) not null default 0,
  compra_id uuid references compras(id) on delete set null,
  venta_id uuid references ventas(id) on delete set null,
  nota text,
  usuario_id uuid references auth.users(id) default auth.uid(),
  fecha timestamptz not null default now()
);
create index movimientos_producto_idx on movimientos_inventario (empresa_id, producto_id, fecha);

create or replace function aplicar_movimiento()
returns trigger language plpgsql as $$
declare
  v_stock numeric;
  v_costo numeric;
begin
  if new.tipo in ('entrada_compra', 'ajuste_entrada', 'anulacion_venta') then
    select stock, costo_promedio into v_stock, v_costo from productos where id = new.producto_id for update;
    update productos set
      stock = stock + new.cantidad,
      costo_promedio = case
        when new.tipo = 'entrada_compra' and v_stock + new.cantidad > 0
          then round(((greatest(v_stock, 0) * v_costo) + (new.cantidad * new.costo_unitario)) / (greatest(v_stock, 0) + new.cantidad), 2)
        else costo_promedio end,
      ultimo_costo = case when new.tipo = 'entrada_compra' then new.costo_unitario else ultimo_costo end,
      actualizado_en = now()
    where id = new.producto_id;
  else
    update productos set stock = stock - new.cantidad, actualizado_en = now()
    where id = new.producto_id;
  end if;
  return new;
end;
$$;

create trigger trg_aplicar_movimiento
after insert on movimientos_inventario
for each row execute function aplicar_movimiento();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table empresas enable row level security;
alter table miembros_empresa enable row level security;

create policy "ver mis empresas" on empresas for select using (es_miembro(id));
create policy "admin edita empresa" on empresas for update using (es_admin(id));

create policy "ver miembros" on miembros_empresa for select using (es_miembro(empresa_id));
create policy "admin agrega miembros" on miembros_empresa for insert with check (es_admin(empresa_id));
create policy "admin edita miembros" on miembros_empresa for update using (es_admin(empresa_id));
create policy "admin quita miembros" on miembros_empresa for delete using (es_admin(empresa_id));

-- Tablas operativas: cualquier miembro de la empresa puede leer y escribir
do $$
declare
  t text;
begin
  foreach t in array array[
    'proveedores', 'categorias', 'productos', 'producto_proveedor',
    'compras', 'compra_items', 'clientes', 'ventas', 'venta_items',
    'seriales', 'movimientos_inventario'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "miembros leen" on %I for select using (es_miembro(empresa_id))', t);
    execute format('create policy "miembros crean" on %I for insert with check (es_miembro(empresa_id))', t);
    execute format('create policy "miembros editan" on %I for update using (es_miembro(empresa_id))', t);
  end loop;
end $$;

-- Borrar solo lo pueden hacer administradores (el kardex nunca se borra)
create policy "admin borra" on productos for delete using (es_admin(empresa_id));
create policy "admin borra" on categorias for delete using (es_admin(empresa_id));
create policy "admin borra" on proveedores for delete using (es_admin(empresa_id));
create policy "admin borra" on clientes for delete using (es_admin(empresa_id));
create policy "admin borra" on compras for delete using (es_admin(empresa_id));
create policy "admin borra" on compra_items for delete using (es_admin(empresa_id));
create policy "admin borra" on producto_proveedor for delete using (es_admin(empresa_id));
create policy "admin borra" on seriales for delete using (es_admin(empresa_id));

-- ---------------------------------------------------------------------
-- Almacenamiento de XML/PDF de compras (bucket privado)
-- Ruta de archivos: <empresa_id>/<compra_id>/<archivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('compras', 'compras', false)
on conflict (id) do nothing;

create policy "miembros leen archivos de compras" on storage.objects for select
  using (bucket_id = 'compras' and es_miembro(((storage.foldername(name))[1])::uuid));
create policy "miembros suben archivos de compras" on storage.objects for insert
  with check (bucket_id = 'compras' and es_miembro(((storage.foldername(name))[1])::uuid));
