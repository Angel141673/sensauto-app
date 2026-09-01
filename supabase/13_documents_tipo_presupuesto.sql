-- ============================================================
-- Añade "presupuesto" como tipo válido en public.documents —
-- el PDF de presupuesto/factura proforma generado desde la ficha
-- del vehículo se guarda aquí automáticamente (vinculado a
-- vehicle_id y client_id) para quedar con historial descargable.
-- ============================================================

alter table public.documents drop constraint documents_tipo_check;
alter table public.documents add constraint documents_tipo_check
  check (tipo = any (array['vehiculo','factura','contrato_reserva','contrato_compraventa','tramite','otro','presupuesto']));
