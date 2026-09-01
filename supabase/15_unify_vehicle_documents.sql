-- ============================================================
-- Unifica la documentación por vehículo: "Contrato de reserva",
-- "Contrato de compraventa", "Factura de compra" y "Factura de
-- venta" pasan de vehicle_documents a la misma tabla que usa la
-- pestaña general "Documentos" (public.documents) — así, se suban
-- desde donde se suban, aparecen en los dos sitios. vehicle_documents
-- queda dedicada solo a la ficha técnica (que sí necesita su propia
-- estructura de cara A / cara B). No había datos reales en ninguno
-- de los dos tipos afectados en el momento de este cambio.
-- ============================================================

alter table public.documents drop constraint documents_tipo_check;
alter table public.documents add constraint documents_tipo_check
  check (tipo = any (array[
    'vehiculo', 'factura', 'contrato_reserva', 'contrato_compraventa',
    'factura_compra', 'factura_venta', 'tramite', 'otro', 'presupuesto'
  ]));

alter table public.vehicle_documents alter column tipo_documento type text;
drop type public.vehicle_document_tipo;

create type public.vehicle_document_tipo as enum (
  'ficha_tecnica_origen_a',
  'ficha_tecnica_origen_b',
  'ficha_tecnica_espanola_a',
  'ficha_tecnica_espanola_b'
);

alter table public.vehicle_documents
  alter column tipo_documento type public.vehicle_document_tipo
  using tipo_documento::public.vehicle_document_tipo;
