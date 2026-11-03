-- =====================================================================
-- CRM VIP TECHNOLOGY - Rol Superadmin
--
-- El "acceso total" pasa a llamarse Superadmin y es el ÚNICO que puede:
--   * dar o quitar acceso de usuarios a empresas y cambiar su rol
--   * activar / inactivar usuarios
--   * eliminar usuarios
--   * nombrar otros superadmin
-- Los administradores de empresa siguen manejando su operación
-- (productos, compras, ventas, reparaciones, configuración).
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

create or replace function asignar_usuario(p_correo text, p_empresa uuid, p_rol rol_usuario)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_usuario uuid;
begin
  if not tiene_acceso_total() then
    raise exception 'Solo un superadmin puede dar acceso a usuarios';
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
  if not tiene_acceso_total() then
    raise exception 'Solo un superadmin puede quitar el acceso a usuarios';
  end if;
  delete from miembros_empresa where empresa_id = p_empresa and usuario_id = p_usuario;
end;
$$;

-- Los administradores de empresa ya no agregan ni editan miembros directamente
drop policy if exists "admin agrega miembros" on miembros_empresa;
drop policy if exists "admin edita miembros" on miembros_empresa;
drop policy if exists "admin quita miembros" on miembros_empresa;
create policy "superadmin agrega miembros" on miembros_empresa for insert with check (tiene_acceso_total());
create policy "superadmin edita miembros" on miembros_empresa for update using (tiene_acceso_total());
create policy "superadmin quita miembros" on miembros_empresa for delete using (tiene_acceso_total());

-- Eliminar un usuario. Si ya tiene movimientos (ventas, compras, órdenes...)
-- no se puede borrar sin perder el historial: en ese caso se debe inactivar.
create or replace function eliminar_usuario(p_usuario uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not tiene_acceso_total() then
    raise exception 'Solo un superadmin puede eliminar usuarios';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'No puede eliminarse a sí mismo';
  end if;
  if exists (select 1 from perfiles where usuario_id = p_usuario and acceso_total)
     and (select count(*) from perfiles where acceso_total and activo and usuario_id <> p_usuario) = 0 then
    raise exception 'Debe quedar al menos un superadmin';
  end if;

  if exists (select 1 from ventas where vendedor_id = p_usuario)
     or exists (select 1 from compras where usuario_id = p_usuario)
     or exists (select 1 from movimientos_inventario where usuario_id = p_usuario)
     or exists (select 1 from pagos where usuario_id = p_usuario)
     or exists (select 1 from ordenes_servicio where creado_por = p_usuario)
     or exists (select 1 from asesorias where creado_por = p_usuario) then
    raise exception 'Este usuario ya tiene registros en el sistema (ventas, compras u órdenes). Para conservar el historial, inactívelo en lugar de eliminarlo.';
  end if;

  -- Sin historial: se borra la cuenta (perfil y accesos se borran en cascada)
  delete from auth.users where id = p_usuario;
end;
$$;

revoke execute on function eliminar_usuario(uuid) from anon, public;
grant execute on function eliminar_usuario(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Usuarios creados por el superadmin con contraseña temporal:
-- deben cambiarla la primera vez que entran.
-- ---------------------------------------------------------------------
alter table perfiles add column if not exists debe_cambiar_clave boolean not null default false;

create or replace function marcar_clave_cambiada()
returns void language sql security definer set search_path = public as $$
  update perfiles set debe_cambiar_clave = false where usuario_id = auth.uid();
$$;

revoke execute on function marcar_clave_cambiada() from anon, public;
grant execute on function marcar_clave_cambiada() to authenticated;
