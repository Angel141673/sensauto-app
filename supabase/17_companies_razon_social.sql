-- ============================================================
-- Añade la razón social (nombre legal para contratos), distinta
-- del nombre comercial ya usado en el resto de la app. Aprovecha
-- para corregir la dirección de SENSAUTO con el dato completo que
-- trae la propia plantilla del contrato de compraventa (incluye
-- código postal, que antes no se había guardado).
-- ============================================================

alter table public.companies
  add column if not exists razon_social text;

update public.companies
set razon_social = 'SENSAUTO 2017, S.L.',
    direccion = 'Avda. Medina Sidonia, Km. 1, 11406 Jerez de la Frontera (Cádiz)'
where code = 'SENSAUTO';

update public.companies
set razon_social = 'SUNAUTO 2012, S.L.'
where code = 'SUNAUTO';
