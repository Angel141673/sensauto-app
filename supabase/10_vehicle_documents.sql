-- ============================================================
-- SENSAUTO / SUNAUTO — Gestión documental por vehículo
-- Documentación específica de cada vehículo (ficha técnica, ITV,
-- contratos, etc.), con envío selectivo al cliente al vender o
-- entregar. Independiente de la tabla genérica public.documents
-- (que sigue existiendo tal cual, para adjuntos generales/gastos).
-- Requiere haber ejecutado 01_schema.sql .. 09_vehiculos_compra_ia.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TIPO DE DOCUMENTO
-- ------------------------------------------------------------
create type public.vehicle_document_tipo as enum (
  'ficha_tecnica',
  'permiso_circulacion',
  'itv',
  'factura_compra',
  'factura_venta',
  'contrato_compraventa',
  'transferencia_dgt',
  'seguro',
  'otro'
);

-- ------------------------------------------------------------
-- 2. TABLA vehicle_documents
-- ------------------------------------------------------------
-- Nota de diseño: "subido_por" se pidió como FK directa a
-- auth.users.id, pero el resto del esquema (created_by en
-- vehicles/clients/operations/documents/expenses/signatures)
-- referencia siempre public.profiles(id) — que comparte el mismo
-- id que auth.users, solo que con el perfil (nombre) ya resuelto.
-- Se sigue esa misma convención aquí por consistencia.
create table public.vehicle_documents (
  id              uuid primary key default gen_random_uuid(),
  vehicle_id      uuid not null references public.vehicles(id) on delete cascade,
  company_id      uuid not null references public.companies(id),
  client_id       uuid references public.clients(id),

  tipo_documento  public.vehicle_document_tipo not null,
  nombre_archivo  text not null,
  storage_path    text not null,
  tamano_bytes    bigint,

  fecha_subida    timestamptz not null default now(),
  subido_por      uuid references public.profiles(id)
);

create index vehicle_documents_vehicle_idx on public.vehicle_documents (vehicle_id);
create index vehicle_documents_company_idx on public.vehicle_documents (company_id);
create index vehicle_documents_client_idx on public.vehicle_documents (client_id);

-- Blindaje: el documento debe pertenecer a la misma empresa que el
-- vehículo (mismo patrón que check_document_company_consistency en
-- 04_documentos.sql). No se compara contra client_id porque los
-- clientes ya no tienen empresa fija (ver 08_clientes_compartidos.sql).
create or replace function public.check_vehicle_document_company_consistency()
returns trigger language plpgsql set search_path = public as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.vehicles where id = new.vehicle_id;

  if v_company is distinct from new.company_id then
    raise exception 'El vehículo del documento pertenece a otra empresa.';
  end if;

  return new;
end;
$$;

create trigger vehicle_documents_check_consistency
  before insert or update on public.vehicle_documents
  for each row execute procedure public.check_vehicle_document_company_consistency();

alter table public.vehicle_documents enable row level security;

create policy "vehicle_documents_by_company_access"
  on public.vehicle_documents for all
  to authenticated
  using (public.user_has_company_access(company_id))
  with check (public.user_has_company_access(company_id));

-- ------------------------------------------------------------
-- 3. AUTO-VINCULAR CLIENTE AL VENDER / ENTREGAR
-- ------------------------------------------------------------
-- El vehículo no tiene un client_id propio (la relación vive en
-- operations). Al pasar a "vendido" o "entregado", se toma el
-- cliente de la operación más reciente de ese vehículo y se aplica
-- a todos sus vehicle_documents ya subidos.
--
-- Nota de diseño (a confirmar): si un vehículo tuviera más de una
-- operación (p. ej. una reserva que no llegó a nada y luego otra
-- venta real), esto usa la operación más reciente por created_at.
-- Si el negocio necesita otro criterio (p. ej. la operación en
-- estado "compraventa"/"entrega" concreto), se ajusta aquí.
create or replace function public.link_vehicle_documents_to_client()
returns trigger language plpgsql set search_path = public as $$
declare
  latest_client uuid;
begin
  if new.estado in ('vendido', 'entregado') and old.estado is distinct from new.estado then
    select client_id into latest_client
    from public.operations
    where vehicle_id = new.id
    order by created_at desc
    limit 1;

    if latest_client is not null then
      update public.vehicle_documents
      set client_id = latest_client
      where vehicle_id = new.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger vehicles_link_documents_to_client
  after update on public.vehicles
  for each row execute procedure public.link_vehicle_documents_to_client();

-- ------------------------------------------------------------
-- 4. BUCKET DE STORAGE
-- ------------------------------------------------------------
-- Ruta: {company_id}/{vehicle_id}/{uuid}-{nombre_archivo} — mismo
-- patrón que el bucket "documentos" (04_documentos.sql): la política
-- lee el primer segmento de la ruta como company_id.
insert into storage.buckets (id, name, public)
values ('vehicle-documents', 'vehicle-documents', false)
on conflict (id) do nothing;

create policy "vehicle_documents_storage_by_company_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid)
  );

create policy "vehicle_documents_storage_by_company_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-documents'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid)
  );

create policy "vehicle_documents_storage_by_company_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid)
  );
