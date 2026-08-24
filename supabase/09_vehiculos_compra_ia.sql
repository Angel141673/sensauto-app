-- ============================================================
-- SENSAUTO / SUNAUTO — Análisis con IA de facturas de compra
-- Columnas nuevas para poder rellenar el alta de vehículo desde
-- una factura de compra analizada con IA: fecha de matriculación
-- completa (no solo el año) y motor + potencia.
-- ============================================================

alter table public.vehicles
  add column if not exists fecha_matriculacion date,
  add column if not exists motor text;
