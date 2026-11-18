-- =====================================================================
-- CRM VIP TECHNOLOGY - Solicitudes de mejoras
--
-- Cualquier usuario puede pedir una mejora o reportar algo que falta.
-- Cada uno ve solo las suyas; quien tiene acceso total las ve todas,
-- cambia el estado y responde.
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

create table if not exists mejoras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete set null,
  usuario_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  tipo text not null default 'mejora' check (tipo in ('mejora', 'falta', 'error')),
  area text not null default 'otro',
  titulo text not null check (length(trim(titulo)) between 3 and 150),
  descripcion text not null check (length(trim(descripcion)) between 3 and 4000),
  prioridad text not null default 'media' check (prioridad in ('baja', 'media', 'alta')),
  estado text not null default 'nueva' check (estado in ('nueva', 'revisando', 'planeada', 'hecha', 'descartada')),
  respuesta text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists mejoras_estado_idx on mejoras (estado, creado_en desc);
create index if not exists mejoras_usuario_idx on mejoras (usuario_id, creado_en desc);

alter table mejoras enable row level security;

drop policy if exists "ver mejoras" on mejoras;
create policy "ver mejoras" on mejoras for select
  using (usuario_id = auth.uid() or tiene_acceso_total());

-- Al crear: siempre a nombre propio, en una empresa de la que es miembro y en estado "nueva"
drop policy if exists "crear mejoras" on mejoras;
create policy "crear mejoras" on mejoras for insert
  with check (
    usuario_id = auth.uid()
    and estado = 'nueva'
    and respuesta is null
    and (empresa_id is null or es_miembro(empresa_id))
  );

drop policy if exists "gestionar mejoras" on mejoras;
create policy "gestionar mejoras" on mejoras for update
  using (tiene_acceso_total())
  with check (tiene_acceso_total());

drop policy if exists "borrar mejoras" on mejoras;
create policy "borrar mejoras" on mejoras for delete
  using (tiene_acceso_total());

grant select, insert, update, delete on mejoras to authenticated;
