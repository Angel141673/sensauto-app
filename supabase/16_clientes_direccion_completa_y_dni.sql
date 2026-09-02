-- ============================================================
-- Cliente: dirección desglosada (calle/código postal/provincia,
-- reutilizando la columna "direccion" existente como la calle) y
-- nuevo tipo de documento "dni" para guardar el escaneo/foto del
-- DNI o NIF del cliente en public.documents.
-- ============================================================

alter table public.clients
  add column if not exists codigo_postal text,
  add column if not exists provincia text;

alter table public.documents drop constraint documents_tipo_check;
alter table public.documents add constraint documents_tipo_check
  check (tipo = any (array[
    'vehiculo', 'factura', 'contrato_reserva', 'contrato_compraventa',
    'factura_compra', 'factura_venta', 'tramite', 'otro', 'presupuesto', 'dni'
  ]));
