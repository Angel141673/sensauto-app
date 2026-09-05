-- ============================================================
-- Sustituye el tipo genérico "dni" por dos tipos distintos —
-- "dni_anverso" y "dni_reverso" — para poder generar después un PDF
-- a tamaño real (85,6 × 54 mm, tamaño ISO/IEC 7810 ID-1) con ambas
-- caras, listo para enviar a Tráfico. No hay documentos "dni"
-- existentes que migrar (tabla vacía en el momento de este cambio).
-- ============================================================

alter table public.documents drop constraint documents_tipo_check;
alter table public.documents add constraint documents_tipo_check
  check (tipo = any (array[
    'vehiculo', 'factura', 'contrato_reserva', 'contrato_compraventa',
    'factura_compra', 'factura_venta', 'factura_rectificativa',
    'tramite', 'otro', 'presupuesto', 'dni_anverso', 'dni_reverso'
  ]));
