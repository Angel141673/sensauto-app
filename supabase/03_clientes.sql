-- ============================================================
-- SENSAUTO / SUNAUTO — Bloque 6: Clientes
-- Ficha de cliente + vinculación con uno o varios vehículos
-- y sus operaciones (reserva, compraventa, entrega, posventa).
-- Requiere haber ejecutado antes 01_schema.sql y 02_vehiculos.sql.
-- ============================================================

create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id),

  nombre        text not null,
  telefono      text,
  email         text,
  dni_nif       text,
  direccion     text,
  notas         text,

  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists clients_search_idx
  on public.clients using gin (
    to_tsvector('simple', coalesce(nombre,'') || ' ' || coalesce(telefono,'') || ' ' || coalesce(dni_nif,''))
  );

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute procedure public.set_updated_at();

alter table public.clients enable row level security;

create policy "clients_by_company_access"
  on public.clients for all
  to authenticated
  using (public.user_has_company_access(company_id))
  with check (public.user_has_company_access(company_id));

-- ------------------------------------------------------------
-- OPERACIONES: vínculo cliente-vehículo con su estado
-- ------------------------------------------------------------
-- Un cliente puede vincularse a uno o varios vehículos (sección 7).
-- La operación es lo que centraliza "reserva / compraventa /
-- entrega / posventa" para ese cliente y ese vehículo concretos.
create table if not exists public.operations (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id),
  vehicle_id    uuid not null references public.vehicles(id),
  client_id     uuid not null references public.clients(id),

  estado        text not null default 'contacto'
                check (estado in (
                  'contacto', 'reserva', 'compraventa', 'entrega', 'posventa'
                )),

  notas         text,

  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists operations_set_updated_at on public.operations;
create trigger operations_set_updated_at
  before update on public.operations
  for each row execute procedure public.set_updated_at();

-- Blindaje extra (regla de seguridad, sección 14): impide que una
-- operación mezcle un vehículo y un cliente de empresas distintas,
-- incluso si alguien tuviera acceso a ambas empresas.
create or replace function public.check_operation_company_consistency()
returns trigger language plpgsql as $$
declare
  vehicle_company uuid;
  client_company uuid;
begin
  select company_id into vehicle_company from public.vehicles where id = new.vehicle_id;
  select company_id into client_company from public.clients where id = new.client_id;

  if vehicle_company is distinct from new.company_id
     or client_company is distinct from new.company_id then
    raise exception 'El vehículo y el cliente deben pertenecer a la misma empresa que la operación.';
  end if;

  return new;
end;
$$;

drop trigger if exists operations_check_consistency on public.operations;
create trigger operations_check_consistency
  before insert or update on public.operations
  for each row execute procedure public.check_operation_company_consistency();

alter table public.operations enable row level security;

create policy "operations_by_company_access"
  on public.operations for all
  to authenticated
  using (public.user_has_company_access(company_id))
  with check (public.user_has_company_access(company_id));
