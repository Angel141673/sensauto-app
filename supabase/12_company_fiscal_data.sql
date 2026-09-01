-- ============================================================
-- SENSAUTO / SUNAUTO — Datos fiscales de empresa para membrete
-- Usados en el presupuesto/factura proforma (PDF). Nullable: si
-- faltan, el membrete simplemente omite esa línea.
-- ============================================================

alter table public.companies
  add column if not exists cif text,
  add column if not exists direccion text,
  add column if not exists telefono text,
  add column if not exists email text;
