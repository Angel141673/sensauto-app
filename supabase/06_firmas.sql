-- ============================================================
-- SENSAUTO / SUNAUTO — Bloque 9: Contratos y firma en tablet
-- Requiere 01_schema.sql .. 05_gastos.sql.
-- ============================================================

-- Bucket separado para firmas (imágenes PNG del trazo).
insert into storage.buckets (id, name, public)
values ('firmas', 'firmas', false)
on conflict (id) do nothing;

create policy "firmas_storage_by_company_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'firmas'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid)
  );

create policy "firmas_storage_by_company_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'firmas'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid)
  );

create table if not exists public.signatures (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id),
  operation_id        uuid not null references public.operations(id),
  client_id           uuid not null references public.clients(id),

  tipo_contrato       text not null check (tipo_contrato in ('reserva', 'compraventa')),
  contract_document_id uuid references public.documents(id), -- plantilla usada, si la hay

  storage_path        text not null,           -- imagen PNG de la firma
  texto_aceptacion    text not null,           -- texto legal aceptado en el momento de firmar
  fecha_firma         date not null default current_date, -- decisión tomada: solo fecha, sin hora

  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);

create index if not exists signatures_operation_idx on public.signatures (operation_id);

create or replace function public.check_signature_company_consistency()
returns trigger language plpgsql as $$
declare
  o_company uuid;
  c_company uuid;
begin
  select company_id into o_company from public.operations where id = new.operation_id;
  select company_id into c_company from public.clients where id = new.client_id;

  if o_company is distinct from new.company_id or c_company is distinct from new.company_id then
    raise exception 'La operación y el cliente de la firma deben pertenecer a la misma empresa.';
  end if;

  return new;
end;
$$;

drop trigger if exists signatures_check_consistency on public.signatures;
create trigger signatures_check_consistency
  before insert or update on public.signatures
  for each row execute procedure public.check_signature_company_consistency();

alter table public.signatures enable row level security;

create policy "signatures_by_company_access"
  on public.signatures for all
  to authenticated
  using (public.user_has_company_access(company_id))
  with check (public.user_has_company_access(company_id));
