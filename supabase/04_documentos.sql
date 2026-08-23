-- ============================================================
-- SENSAUTO / SUNAUTO — Bloque 7: Documentos
-- Repositorio documental por empresa, vehículo, cliente y
-- operación, con detección de duplicados exactos por hash.
-- Requiere haber ejecutado antes 01_schema.sql, 02_vehiculos.sql
-- y 03_clientes.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. BUCKET DE ALMACENAMIENTO (Supabase Storage)
-- ------------------------------------------------------------
-- Privado: el acceso se controla por políticas, no por URL pública.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Los archivos se guardan bajo la ruta "<company_id>/<uuid>-<nombre>"
-- así la política de Storage puede comprobar la empresa del archivo
-- leyendo el primer segmento de la ruta.
create policy "documentos_storage_by_company_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documentos'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid)
  );

create policy "documentos_storage_by_company_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documentos'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid)
  );

create policy "documentos_storage_by_company_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documentos'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid)
  );

-- ------------------------------------------------------------
-- 2. TABLA DE DOCUMENTOS
-- ------------------------------------------------------------
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id),

  -- Vínculos opcionales: un documento puede colgar de un vehículo,
  -- un cliente, una operación, o de ninguno (documento general).
  vehicle_id      uuid references public.vehicles(id),
  client_id       uuid references public.clients(id),
  operation_id    uuid references public.operations(id),

  tipo            text not null check (tipo in (
                    'vehiculo', 'factura', 'contrato_reserva',
                    'contrato_compraventa', 'tramite', 'otro'
                  )),

  nombre_archivo  text not null,
  storage_path    text not null,        -- ruta dentro del bucket "documentos"
  mime_type       text,
  tamano_bytes    bigint,
  hash_sha256     text not null,        -- para detectar duplicados exactos

  notas           text,

  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

-- Detección de duplicados: mismo archivo (mismo hash) ya subido
-- en la misma empresa. No se bloquea a nivel de base de datos
-- (el aviso lo gestiona la aplicación antes de guardar), pero el
-- índice permite comprobarlo de forma barata.
create index if not exists documents_hash_company_idx
  on public.documents (company_id, hash_sha256);

create index if not exists documents_vehicle_idx on public.documents (vehicle_id);
create index if not exists documents_client_idx on public.documents (client_id);

-- Blindaje: si el documento indica vehículo/cliente/operación,
-- deben pertenecer a la misma empresa que el documento.
create or replace function public.check_document_company_consistency()
returns trigger language plpgsql as $$
declare
  v_company uuid;
  c_company uuid;
  o_company uuid;
begin
  if new.vehicle_id is not null then
    select company_id into v_company from public.vehicles where id = new.vehicle_id;
    if v_company is distinct from new.company_id then
      raise exception 'El vehículo del documento pertenece a otra empresa.';
    end if;
  end if;

  if new.client_id is not null then
    select company_id into c_company from public.clients where id = new.client_id;
    if c_company is distinct from new.company_id then
      raise exception 'El cliente del documento pertenece a otra empresa.';
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

drop trigger if exists documents_check_consistency on public.documents;
create trigger documents_check_consistency
  before insert or update on public.documents
  for each row execute procedure public.check_document_company_consistency();

alter table public.documents enable row level security;

create policy "documents_by_company_access"
  on public.documents for all
  to authenticated
  using (public.user_has_company_access(company_id))
  with check (public.user_has_company_access(company_id));
