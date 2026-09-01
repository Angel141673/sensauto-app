-- ============================================================
-- Redefine los tipos de "Documentación del vehículo" — lista
-- reducida y específica pedida por el usuario: solo contrato de
-- compraventa, factura de compra, factura de venta, y las dos
-- fichas técnicas (país de origen y española), cada una con cara
-- A y cara B. No había datos reales en vehicle_documents en el
-- momento de este cambio, así que se recrea el tipo entero en vez
-- de solo añadir valores (evita dejar valores viejos sin uso).
-- ============================================================

alter table public.vehicle_documents alter column tipo_documento type text;
drop type public.vehicle_document_tipo;

create type public.vehicle_document_tipo as enum (
  'contrato_reserva',
  'contrato_compraventa',
  'factura_compra',
  'factura_venta',
  'ficha_tecnica_origen_a',
  'ficha_tecnica_origen_b',
  'ficha_tecnica_espanola_a',
  'ficha_tecnica_espanola_b'
);

alter table public.vehicle_documents
  alter column tipo_documento type public.vehicle_document_tipo
  using tipo_documento::public.vehicle_document_tipo;
