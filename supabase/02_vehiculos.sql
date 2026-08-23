-- ============================================================
-- SENSAUTO / SUNAUTO — Bloque 4: Vehículos
-- Ficha central del vehículo + buscador marca/modelo/VIN
-- Requiere haber ejecutado antes 01_schema.sql (companies,
-- profiles, user_companies, user_has_company_access()).
-- ============================================================

create table if not exists public.vehicles (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id),

  -- Identificación
  marca                 text not null,
  modelo                text not null,
  vin                   text,                 -- bastidor/VIN
  matricula             text,

  -- Datos técnicos
  anio                  integer,
  km                     integer,
  combustible           text,                 -- gasolina / diésel / híbrido / eléctrico...
  transmision           text,                 -- manual / automática
  color                 text,

  -- Económico
  precio_compra         numeric(10,2),
  precio_venta_previsto numeric(10,2),
  precio_venta_real     numeric(10,2),
  -- Nota: "inversión total" sumará gastos asociados cuando se
  -- implemente el Bloque 8 (facturas/gastos). Por ahora la
  -- inversión mostrada en pantalla es solo precio_compra.

  -- Estado del ciclo de vida (sección 6 del paquete de traspaso)
  estado                text not null default 'entrada'
                        check (estado in (
                          'entrada', 'preparacion', 'disponible',
                          'reservado', 'vendido', 'entregado', 'posventa'
                        )),

  notas                 text,

  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- VIN único por empresa cuando se informa (evita altas duplicadas).
create unique index if not exists vehicles_vin_unique_per_company
  on public.vehicles (company_id, vin)
  where vin is not null and vin <> '';

-- Búsqueda rápida por marca/modelo/VIN.
create index if not exists vehicles_search_idx
  on public.vehicles using gin (
    to_tsvector('simple', coalesce(marca,'') || ' ' || coalesce(modelo,'') || ' ' || coalesce(vin,''))
  );

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- RLS: misma plantilla documentada en 01_schema.sql
-- ------------------------------------------------------------
alter table public.vehicles enable row level security;

create policy "vehicles_by_company_access"
  on public.vehicles for all
  to authenticated
  using (public.user_has_company_access(company_id))
  with check (public.user_has_company_access(company_id));
