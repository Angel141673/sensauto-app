-- ============================================================
-- SENSAUTO / SUNAUTO — Bloque 11 (previo): fecha de venta
-- Necesaria para agrupar inversión/margen por mes o trimestre.
-- ============================================================

alter table public.vehicles
  add column if not exists fecha_venta date;
