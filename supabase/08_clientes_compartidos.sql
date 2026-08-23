-- ============================================================
-- SENSAUTO / SUNAUTO — Clientes compartidos entre empresas
-- Los clientes dejan de pertenecer a una empresa fija: un mismo
-- cliente puede tener operaciones tanto en SENSAUTO como en
-- SUNAUTO. La empresa de cada operación se hereda siempre del
-- vehículo vinculado (nunca del cliente, nunca elegida a mano).
-- Requiere haber ejecutado 01_schema.sql .. 07_fecha_venta.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. FUNCIÓN AUXILIAR: ¿es el usuario parte del equipo?
-- ------------------------------------------------------------
-- Igual que user_has_company_access(), pero sin atarse a una
-- empresa concreta: basta con tener acceso a alguna de las dos
-- para operar sobre clientes, que ahora son compartidos.
create or replace function public.user_is_staff()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_companies uc
    where uc.user_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- 2. CLIENTES: quitar la empresa fija
-- ------------------------------------------------------------
drop policy if exists "clients_by_company_access" on public.clients;

alter table public.clients drop column if exists company_id;

create policy "clients_staff_access"
  on public.clients for all
  to authenticated
  using (public.user_is_staff())
  with check (public.user_is_staff());

-- ------------------------------------------------------------
-- 3. OPERACIONES: la empresa se hereda del vehículo, siempre
-- ------------------------------------------------------------
-- Antes este trigger solo VALIDABA que company_id coincidiera con
-- vehículo y cliente. Ahora ASIGNA company_id desde el vehículo
-- directamente, así ninguna pantalla puede mandarla a mano ni
-- equivocarse. Ya no hay comprobación contra el cliente: el
-- cliente no tiene empresa.
create or replace function public.check_operation_company_consistency()
returns trigger language plpgsql as $$
declare
  vehicle_company uuid;
begin
  select company_id into vehicle_company from public.vehicles where id = new.vehicle_id;

  if vehicle_company is null then
    raise exception 'El vehículo indicado no existe o no tiene empresa asignada.';
  end if;

  new.company_id := vehicle_company;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 4. DOCUMENTOS Y FIRMAS: quitar la comprobación contra cliente
-- ------------------------------------------------------------
create or replace function public.check_document_company_consistency()
returns trigger language plpgsql as $$
declare
  v_company uuid;
  o_company uuid;
begin
  if new.vehicle_id is not null then
    select company_id into v_company from public.vehicles where id = new.vehicle_id;
    if v_company is distinct from new.company_id then
      raise exception 'El vehículo del documento pertenece a otra empresa.';
    end if;
  end if;

  if new.operation_id is not null then
    select company_id into o_company from public.operations where id = new.operation_id;
    if o_company is distinct from new.company_id then
      raise exception 'La operación del documento pertenece a otra empresa.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.check_signature_company_consistency()
returns trigger language plpgsql as $$
declare
  o_company uuid;
begin
  select company_id into o_company from public.operations where id = new.operation_id;

  if o_company is distinct from new.company_id then
    raise exception 'La operación de la firma pertenece a otra empresa.';
  end if;

  return new;
end;
$$;
