-- ============================================================
-- Añade soporte de facturas rectificativas al sistema de
-- facturación ya existente (public.invoices + public.invoice_counters
-- + public.siguiente_numero_factura), y el tipo de documento
-- correspondiente en public.documents.
--
-- public.invoices tenía una única factura por operación
-- (invoices_operation_id_key, UNIQUE sobre operation_id) — eso vale
-- para la factura de venta original, pero una operación puede
-- necesitar más de una rectificativa a lo largo del tiempo. Se
-- sustituye por un índice único parcial que solo protege el tipo
-- 'venta'; la numeración correlativa (company_id, anio, numero)
-- sigue siendo única para todas las facturas, sea cual sea su tipo.
-- ============================================================

alter table public.invoices
  add column if not exists tipo text not null default 'venta',
  add column if not exists rectifica_invoice_id uuid references public.invoices(id);

alter table public.invoices drop constraint if exists invoices_tipo_check;
alter table public.invoices add constraint invoices_tipo_check
  check (tipo in ('venta', 'rectificativa'));

alter table public.invoices drop constraint if exists invoices_operation_id_key;
create unique index if not exists invoices_operation_id_venta_unique
  on public.invoices (operation_id)
  where tipo = 'venta';

alter table public.documents drop constraint documents_tipo_check;
alter table public.documents add constraint documents_tipo_check
  check (tipo = any (array[
    'vehiculo', 'factura', 'contrato_reserva', 'contrato_compraventa',
    'factura_compra', 'factura_venta', 'factura_rectificativa',
    'tramite', 'otro', 'presupuesto', 'dni'
  ]));
