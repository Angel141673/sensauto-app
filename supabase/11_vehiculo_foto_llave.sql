-- ============================================================
-- SENSAUTO / SUNAUTO — Foto de identificación y número de llave
-- Añade una foto principal por vehículo (para identificarlo a golpe
-- de vista en el listado) y el número de llave interno (localizar
-- la llave física en el taller/oficina). Requiere haber ejecutado
-- 01_schema.sql .. 10_vehicle_documents.sql.
-- ============================================================

alter table public.vehicles
  add column if not exists foto_path text,
  add column if not exists numero_llave text;

-- ------------------------------------------------------------
-- BUCKET DE STORAGE PARA LA FOTO
-- ------------------------------------------------------------
-- Ruta: {company_id}/{vehicle_id}/{uuid}-{nombre_archivo} — mismo
-- patrón que "vehicle-documents" (10_vehicle_documents.sql): la
-- política lee el primer segmento de la ruta como company_id. Solo
-- se conserva una foto por vehículo (foto_path); al reemplazarla se
-- borra el archivo anterior desde la app.
insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', false)
on conflict (id) do nothing;

create policy "vehicle_photos_storage_by_company_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid)
  );

create policy "vehicle_photos_storage_by_company_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-photos'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid)
  );

create policy "vehicle_photos_storage_by_company_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and public.user_has_company_access(((storage.foldername(name))[1])::uuid)
  );
