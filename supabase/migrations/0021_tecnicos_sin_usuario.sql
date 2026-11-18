-- =====================================================================
-- CRM VIP TECHNOLOGY - Técnicos sin usuario
--
-- Técnicos que solo se asignan a órdenes y asesorías por su nombre, sin
-- entrar al sistema. Conviven con los usuarios de rol Técnico: la lista
-- "Técnico asignado" muestra ambos.
--   * empresa_id vacío = aparece en todas las empresas
--   * los administra el superadmin (Configuración > Técnicos)
--   * no se borran: se inactivan para no perder el historial
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

create table if not exists tecnicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  celular text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table tecnicos enable row level security;

drop policy if exists "ver tecnicos" on tecnicos;
create policy "ver tecnicos" on tecnicos for select
  using (empresa_id is null or es_miembro(empresa_id) or tiene_acceso_total());
drop policy if exists "superadmin crea tecnicos" on tecnicos;
create policy "superadmin crea tecnicos" on tecnicos for insert with check (tiene_acceso_total());
drop policy if exists "superadmin edita tecnicos" on tecnicos;
create policy "superadmin edita tecnicos" on tecnicos for update using (tiene_acceso_total());

-- El técnico de una orden o asesoría puede ser un usuario o uno de esta tabla
alter table ordenes_servicio drop constraint if exists ordenes_servicio_tecnico_id_fkey;
alter table asesorias drop constraint if exists asesorias_tecnico_id_fkey;

-- Lista de técnicos de una empresa: usuarios con rol Técnico + técnicos sin usuario activos
create or replace function tecnicos_empresa(p_empresa uuid)
returns table (usuario_id uuid, nombre text, celular text)
language sql stable security definer set search_path = public as $$
  select * from (
    select p.usuario_id, coalesce(p.nombre, p.correo), p.celular
    from miembros_empresa m
    join perfiles p on p.usuario_id = m.usuario_id and p.activo
    where m.empresa_id = p_empresa
      and m.rol::text = 'tecnico'
      and es_miembro(p_empresa)
    union all
    select t.id, t.nombre, t.celular
    from tecnicos t
    where t.activo
      and (t.empresa_id is null or t.empresa_id = p_empresa)
      and es_miembro(p_empresa)
  ) x
  order by 2;
$$;
