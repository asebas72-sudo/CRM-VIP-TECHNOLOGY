-- =====================================================================
-- CRM VIP TECHNOLOGY - Gastos e inversiones
--
-- Salidas de dinero que no son compras de mercancía:
--   * gasto: arriendo, servicios, nómina, transporte... (resta a la utilidad)
--   * inversion: equipos, herramientas, adecuaciones... (sale dinero pero
--     queda un bien; no resta a la utilidad del periodo)
-- Cualquier miembro registra los suyos; el administrador de la empresa
-- ve todos, los corrige y los borra.
-- Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  fecha date not null default (now() at time zone 'America/Bogota')::date,
  tipo text not null default 'gasto' check (tipo in ('gasto', 'inversion')),
  categoria text not null default 'otro',
  descripcion text not null check (length(trim(descripcion)) between 2 and 500),
  valor numeric(14,2) not null check (valor > 0),
  forma_pago text not null default 'efectivo' check (forma_pago in ('efectivo', 'tarjeta', 'transferencia')),
  beneficiario text,
  usuario_id uuid references auth.users(id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now()
);
create index if not exists gastos_empresa_fecha_idx on gastos (empresa_id, fecha desc);

alter table gastos enable row level security;

drop policy if exists "ver gastos" on gastos;
create policy "ver gastos" on gastos for select
  using (es_admin(empresa_id) or (usuario_id = auth.uid() and es_miembro(empresa_id)));

drop policy if exists "registrar gastos" on gastos;
create policy "registrar gastos" on gastos for insert
  with check (es_miembro(empresa_id) and usuario_id = auth.uid());

drop policy if exists "admin corrige gastos" on gastos;
create policy "admin corrige gastos" on gastos for update
  using (es_admin(empresa_id))
  with check (es_admin(empresa_id));

drop policy if exists "admin borra gastos" on gastos;
create policy "admin borra gastos" on gastos for delete
  using (es_admin(empresa_id));

grant select, insert, update, delete on gastos to authenticated;
