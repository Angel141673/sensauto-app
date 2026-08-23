-- ============================================================
-- SENSAUTO / SUNAUTO — Bloque 8: Gastos / Facturas
-- Requiere 01_schema.sql, 02_vehiculos.sql, 03_clientes.sql,
-- 04_documentos.sql.
-- ============================================================

create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id),
  vehicle_id      uuid references public.vehicles(id),
  document_id     uuid references public.documents(id), -- foto/factura original

  proveedor       text,
  fecha           date,
  base            numeric(10,2),
  total           numeric(10,2) not null,

  -- El total puede venir de OCR con baja confianza: hasta que el
  -- usuario lo confirma explícitamente, queda marcado como tal.
  total_confirmado boolean not null default false,

  notas           text,

  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

create index if not exists expenses_vehicle_idx on public.expenses (vehicle_id);
create index if not exists expenses_company_dup_idx
  on public.expenses (company_id, proveedor, fecha, total);

create or replace function public.check_expense_company_consistency()
returns trigger language plpgsql as $$
declare
  v_company uuid;
  d_company uuid;
begin
  if new.vehicle_id is not null then
    select company_id into v_company from public.vehicles where id = new.vehicle_id;
    if v_company is distinct from new.company_id then
      raise exception 'El vehículo del gasto pertenece a otra empresa.';
    end if;
  end if;

  if new.document_id is not null then
    select company_id into d_company from public.documents where id = new.document_id;
    if d_company is distinct from new.company_id then
      raise exception 'El documento del gasto pertenece a otra empresa.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists expenses_check_consistency on public.expenses;
create trigger expenses_check_consistency
  before insert or update on public.expenses
  for each row execute procedure public.check_expense_company_consistency();

alter table public.expenses enable row level security;

create policy "expenses_by_company_access"
  on public.expenses for all
  to authenticated
  using (public.user_has_company_access(company_id))
  with check (public.user_has_company_access(company_id));
