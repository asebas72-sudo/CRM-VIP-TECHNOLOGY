-- =====================================================================
-- CRM VIP TECHNOLOGY - Módulo de Reparaciones y Asesorías
-- (migrado desde el sistema en Google Apps Script)
--
-- * ordenes_servicio : ingreso del equipo + ficha técnica de reparación
--                      (en el sistema anterior eran las hojas Ingresos y
--                      Reparaciones, que se mantenían en espejo).
-- * asesorias        : solicitudes de asesoría / visita técnica.
-- * marcas           : lista de marcas de equipos.
-- Cada "sede" del sistema anterior es una empresa de este sistema.
--
-- Requiere haber ejecutado antes 0008_rol_tecnico.sql.
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Datos de apoyo
-- ---------------------------------------------------------------------
alter table perfiles add column if not exists celular text;

alter table empresas
  add column if not exists siguiente_orden int not null default 1,
  add column if not exists siguiente_asesoria int not null default 1,
  add column if not exists dias_entrega_servicio int not null default 8,
  add column if not exists valor_revision numeric(14,2) not null default 20000;

create table if not exists marcas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  creado_en timestamptz not null default now()
);
alter table marcas enable row level security;
drop policy if exists "usuarios leen marcas" on marcas;
create policy "usuarios leen marcas" on marcas for select to authenticated using (true);
drop policy if exists "usuarios crean marcas" on marcas;
create policy "usuarios crean marcas" on marcas for insert to authenticated with check (true);

insert into marcas (nombre) values
  ('Acer'), ('Apple'), ('Asus'), ('Brother'), ('Canon'), ('Compumax'), ('Dell'), ('Epson'),
  ('Genérico'), ('HP'), ('Huawei'), ('Janus'), ('Lenovo'), ('LG'), ('Microsoft'), ('MSI'),
  ('Samsung'), ('Sony'), ('Toshiba'), ('Xiaomi'), ('Otra')
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------
-- Funciones de apoyo
-- ---------------------------------------------------------------------

-- Siguiente número de orden o de asesoría de una empresa (sin saltos ni repetidos)
create or replace function reservar_consecutivo(p_empresa uuid, p_tipo text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_numero int;
begin
  if not es_miembro(p_empresa) then
    raise exception 'Sin acceso a esta empresa';
  end if;
  if p_tipo = 'orden' then
    update empresas set siguiente_orden = siguiente_orden + 1 where id = p_empresa
    returning siguiente_orden - 1 into v_numero;
  elsif p_tipo = 'asesoria' then
    update empresas set siguiente_asesoria = siguiente_asesoria + 1 where id = p_empresa
    returning siguiente_asesoria - 1 into v_numero;
  else
    raise exception 'Tipo de consecutivo inválido';
  end if;
  return v_numero;
end;
$$;

-- Técnicos de una empresa (nombre y celular) visibles para cualquier miembro
create or replace function tecnicos_empresa(p_empresa uuid)
returns table (usuario_id uuid, nombre text, celular text)
language sql stable security definer set search_path = public as $$
  select p.usuario_id, coalesce(p.nombre, p.correo), p.celular
  from miembros_empresa m
  join perfiles p on p.usuario_id = m.usuario_id and p.activo
  where m.empresa_id = p_empresa
    and m.rol::text = 'tecnico'
    and es_miembro(p_empresa)
  order by 2;
$$;

-- Nombres de usuarios de una empresa (para mostrar quién atendió / técnico)
create or replace function nombres_usuarios_empresa(p_empresa uuid)
returns table (usuario_id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.usuario_id, coalesce(p.nombre, p.correo)
  from miembros_empresa m
  join perfiles p on p.usuario_id = m.usuario_id
  where m.empresa_id = p_empresa and es_miembro(p_empresa);
$$;

-- Celular de un usuario: lo cambia él mismo o un administrador de una de sus empresas
create or replace function definir_celular(p_usuario uuid, p_celular text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_usuario <> auth.uid()
     and not tiene_acceso_total()
     and not exists (
       select 1 from miembros_empresa m where m.usuario_id = p_usuario and es_admin(m.empresa_id)
     ) then
    raise exception 'Sin permiso para cambiar este usuario';
  end if;
  update perfiles set celular = nullif(regexp_replace(coalesce(p_celular, ''), '\D', '', 'g'), '')
  where usuario_id = p_usuario;
end;
$$;

-- ¿El usuario actual puede trabajar en servicio técnico en esta empresa?
create or replace function puede_servicio(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(rol_en(p_empresa)::text in ('admin', 'vendedor', 'tecnico'), false);
$$;

-- ---------------------------------------------------------------------
-- Órdenes de servicio (ingreso + reparación)
-- ---------------------------------------------------------------------
create table if not exists ordenes_servicio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  consecutivo int not null,
  codigo text not null,
  cliente_id uuid references clientes(id) on delete set null,
  cliente_nombre text not null,
  cliente_documento text not null,
  celular text not null,
  correo text,
  equipo text not null,
  tipo_equipo text not null,
  marca text not null,
  accesorios text[] not null default '{}',
  fallas text,
  observaciones text,
  foto_ingreso_path text,
  firma_path text,
  estado text not null default 'INGRESADO'
    check (estado in ('INGRESADO', 'TALLER', 'EN PROCESO', 'ESPERA REPUESTOS', 'REVISADO', 'LISTO', 'ENTREGADO')),
  tecnico_id uuid references auth.users(id) on delete set null,
  fecha_ingreso timestamptz not null default now(),
  fecha_entrega_estimada date,
  fecha_reparacion date,
  costo numeric(14,2),
  comentario1 text,
  comentario2 text,
  observacion_final text,
  fotos text[] not null default '{}',
  entregado_en timestamptz,
  creado_por uuid references auth.users(id) default auth.uid(),
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, consecutivo),
  unique (codigo)
);
create index if not exists ordenes_servicio_empresa_idx on ordenes_servicio (empresa_id, fecha_ingreso desc);

alter table ordenes_servicio enable row level security;

-- Admin y vendedor ven todo; el técnico ve lo suyo y lo que aún no tiene técnico
drop policy if exists "ver ordenes" on ordenes_servicio;
create policy "ver ordenes" on ordenes_servicio for select using (
  puede_servicio(empresa_id)
  and (rol_en(empresa_id)::text <> 'tecnico' or tecnico_id is null or tecnico_id = auth.uid())
);
drop policy if exists "crear ordenes" on ordenes_servicio;
create policy "crear ordenes" on ordenes_servicio for insert with check (puede_servicio(empresa_id));
drop policy if exists "editar ordenes" on ordenes_servicio;
create policy "editar ordenes" on ordenes_servicio for update using (
  puede_servicio(empresa_id)
  and (rol_en(empresa_id)::text <> 'tecnico' or tecnico_id is null or tecnico_id = auth.uid())
);
drop policy if exists "admin borra ordenes" on ordenes_servicio;
create policy "admin borra ordenes" on ordenes_servicio for delete using (es_admin(empresa_id));

-- ---------------------------------------------------------------------
-- Asesorías
-- ---------------------------------------------------------------------
create table if not exists asesorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  consecutivo int not null,
  cliente_id uuid references clientes(id) on delete set null,
  cliente_nombre text not null,
  cliente_documento text not null,
  celular text not null,
  correo text,
  solicitud text not null,
  fallas text,
  observaciones text,
  imagen_path text,
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'CONFIRMADA', 'REALIZADA', 'CANCELADA')),
  costo numeric(14,2),
  observacion_final text,
  fecha_visita timestamptz,
  tecnico_id uuid references auth.users(id) on delete set null,
  fecha timestamptz not null default now(),
  creado_por uuid references auth.users(id) default auth.uid(),
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, consecutivo)
);
create index if not exists asesorias_empresa_idx on asesorias (empresa_id, fecha desc);

alter table asesorias enable row level security;

drop policy if exists "ver asesorias" on asesorias;
create policy "ver asesorias" on asesorias for select using (
  puede_servicio(empresa_id)
  and (rol_en(empresa_id)::text <> 'tecnico' or tecnico_id is null or tecnico_id = auth.uid())
);
drop policy if exists "crear asesorias" on asesorias;
create policy "crear asesorias" on asesorias for insert with check (puede_servicio(empresa_id));
-- Una asesoría REALIZADA ya no admite cambios
drop policy if exists "editar asesorias" on asesorias;
create policy "editar asesorias" on asesorias for update using (
  puede_servicio(empresa_id)
  and estado <> 'REALIZADA'
  and (rol_en(empresa_id)::text <> 'tecnico' or tecnico_id is null or tecnico_id = auth.uid())
) with check (
  -- la fila nueva sí puede quedar REALIZADA
  puede_servicio(empresa_id)
  and (rol_en(empresa_id)::text <> 'tecnico' or tecnico_id is null or tecnico_id = auth.uid())
);
drop policy if exists "admin borra asesorias" on asesorias;
create policy "admin borra asesorias" on asesorias for delete using (es_admin(empresa_id));

-- ---------------------------------------------------------------------
-- Archivos: fotos, firmas y evidencias (bucket privado)
-- Ruta: <empresa_id>/<orden o asesoria>/<archivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('servicio', 'servicio', false)
on conflict (id) do nothing;

drop policy if exists "servicio leer archivos" on storage.objects;
create policy "servicio leer archivos" on storage.objects for select
  using (bucket_id = 'servicio' and puede_servicio(((storage.foldername(name))[1])::uuid));
drop policy if exists "servicio subir archivos" on storage.objects;
create policy "servicio subir archivos" on storage.objects for insert
  with check (bucket_id = 'servicio' and puede_servicio(((storage.foldername(name))[1])::uuid));
drop policy if exists "servicio actualizar archivos" on storage.objects;
create policy "servicio actualizar archivos" on storage.objects for update
  using (bucket_id = 'servicio' and puede_servicio(((storage.foldername(name))[1])::uuid));
drop policy if exists "servicio borrar archivos" on storage.objects;
create policy "servicio borrar archivos" on storage.objects for delete
  using (bucket_id = 'servicio' and puede_servicio(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------
revoke execute on function reservar_consecutivo(uuid, text) from anon, public;
revoke execute on function tecnicos_empresa(uuid) from anon, public;
revoke execute on function nombres_usuarios_empresa(uuid) from anon, public;
revoke execute on function definir_celular(uuid, text) from anon, public;
revoke execute on function puede_servicio(uuid) from anon, public;
grant execute on function reservar_consecutivo(uuid, text) to authenticated;
grant execute on function tecnicos_empresa(uuid) to authenticated;
grant execute on function nombres_usuarios_empresa(uuid) to authenticated;
grant execute on function definir_celular(uuid, text) to authenticated;
grant execute on function puede_servicio(uuid) to authenticated;
