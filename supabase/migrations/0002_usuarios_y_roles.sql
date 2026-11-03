-- =====================================================================
-- CRM VIP TECHNOLOGY - Usuarios, roles y acceso por empresa
--
-- * Usuario con "acceso total": ve y administra TODAS las empresas,
--   incluidas las que se creen en el futuro. Solo ellos crean empresas.
-- * Los demás usuarios se asignan a una o varias empresas, con un rol
--   en cada una: admin, bodega o vendedor.
-- * Quien se registra sin asignación no ve nada hasta que un
--   administrador le dé acceso.
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfiles (un registro por usuario de Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists perfiles (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  correo text not null,
  acceso_total boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create or replace function crear_perfil_de_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (usuario_id, nombre, correo)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)), new.email)
  on conflict (usuario_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_crear_perfil on auth.users;
create trigger trg_crear_perfil
after insert on auth.users
for each row execute function crear_perfil_de_usuario();

-- Perfiles de los usuarios que ya existían
insert into perfiles (usuario_id, nombre, correo)
select id, coalesce(raw_user_meta_data ->> 'nombre', split_part(email, '@', 1)), email
from auth.users
on conflict (usuario_id) do nothing;

-- Quien ya administra una empresa (el primer usuario) queda con acceso total
update perfiles set acceso_total = true
where usuario_id in (select usuario_id from miembros_empresa where rol = 'admin');

-- ---------------------------------------------------------------------
-- Funciones de permisos (reemplazan las de la migración 0001)
-- ---------------------------------------------------------------------
create or replace function tiene_acceso_total()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
    where usuario_id = auth.uid() and acceso_total and activo
  );
$$;

create or replace function es_miembro(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select tiene_acceso_total() or exists (
    select 1 from miembros_empresa m
    join perfiles p on p.usuario_id = m.usuario_id and p.activo
    where m.empresa_id = p_empresa and m.usuario_id = auth.uid()
  );
$$;

create or replace function es_admin(p_empresa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select tiene_acceso_total() or exists (
    select 1 from miembros_empresa m
    join perfiles p on p.usuario_id = m.usuario_id and p.activo
    where m.empresa_id = p_empresa and m.usuario_id = auth.uid() and m.rol = 'admin'
  );
$$;

-- Solo usuarios con acceso total crean empresas
create or replace function crear_empresa(p_nombre text, p_nit text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not tiene_acceso_total() then
    raise exception 'Solo un usuario con acceso total puede crear empresas';
  end if;
  insert into empresas (nombre, nit) values (p_nombre, p_nit) returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Gestión de usuarios
-- ---------------------------------------------------------------------

-- Asigna (o cambia) el rol de un usuario en una empresa, buscándolo por correo.
create or replace function asignar_usuario(p_correo text, p_empresa uuid, p_rol rol_usuario)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_usuario uuid;
begin
  if not es_admin(p_empresa) then
    raise exception 'No tiene permiso para administrar usuarios de esta empresa';
  end if;

  select usuario_id into v_usuario from perfiles where lower(correo) = lower(trim(p_correo));
  if v_usuario is null then
    raise exception 'No existe un usuario registrado con el correo %. Pídale que se registre primero.', p_correo;
  end if;

  insert into miembros_empresa (empresa_id, usuario_id, rol)
  values (p_empresa, v_usuario, p_rol)
  on conflict (empresa_id, usuario_id) do update set rol = excluded.rol;
end;
$$;

create or replace function quitar_usuario(p_usuario uuid, p_empresa uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin(p_empresa) then
    raise exception 'No tiene permiso para administrar usuarios de esta empresa';
  end if;
  delete from miembros_empresa where empresa_id = p_empresa and usuario_id = p_usuario;
end;
$$;

-- Da o quita acceso total. Solo lo puede hacer alguien con acceso total.
create or replace function definir_acceso_total(p_usuario uuid, p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not tiene_acceso_total() then
    raise exception 'Solo un usuario con acceso total puede cambiar este permiso';
  end if;
  if not p_valor and (select count(*) from perfiles where acceso_total and activo and usuario_id <> p_usuario) = 0 then
    raise exception 'Debe quedar al menos un usuario con acceso total';
  end if;
  update perfiles set acceso_total = p_valor where usuario_id = p_usuario;
end;
$$;

-- Activa o desactiva un usuario (desactivado no ve ninguna empresa).
create or replace function definir_usuario_activo(p_usuario uuid, p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not tiene_acceso_total() then
    raise exception 'Solo un usuario con acceso total puede activar o desactivar usuarios';
  end if;
  if p_usuario = auth.uid() and not p_valor then
    raise exception 'No puede desactivarse a sí mismo';
  end if;
  update perfiles set activo = p_valor where usuario_id = p_usuario;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS de perfiles: cada quien ve el suyo; los administradores ven a los
-- miembros de sus empresas; acceso total ve a todos.
-- ---------------------------------------------------------------------
alter table perfiles enable row level security;

drop policy if exists "ver perfiles" on perfiles;
create policy "ver perfiles" on perfiles for select using (
  usuario_id = auth.uid()
  or tiene_acceso_total()
  or exists (
    select 1 from miembros_empresa m
    where m.usuario_id = perfiles.usuario_id and es_admin(m.empresa_id)
  )
);

drop policy if exists "editar mi nombre" on perfiles;
create policy "editar mi nombre" on perfiles for update
  using (usuario_id = auth.uid())
  with check (
    usuario_id = auth.uid()
    and acceso_total = (select p.acceso_total from perfiles p where p.usuario_id = auth.uid())
    and activo = (select p.activo from perfiles p where p.usuario_id = auth.uid())
  );

-- Las funciones de gestión solo para usuarios con sesión
revoke execute on function asignar_usuario(text, uuid, rol_usuario) from anon, public;
revoke execute on function quitar_usuario(uuid, uuid) from anon, public;
revoke execute on function definir_acceso_total(uuid, boolean) from anon, public;
revoke execute on function definir_usuario_activo(uuid, boolean) from anon, public;
revoke execute on function crear_empresa(text, text) from anon, public;
grant execute on function asignar_usuario(text, uuid, rol_usuario) to authenticated;
grant execute on function quitar_usuario(uuid, uuid) to authenticated;
grant execute on function definir_acceso_total(uuid, boolean) to authenticated;
grant execute on function definir_usuario_activo(uuid, boolean) to authenticated;
grant execute on function crear_empresa(text, text) to authenticated;
