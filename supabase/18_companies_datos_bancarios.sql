-- ============================================================
-- Añade los datos bancarios de la empresa (IBAN(s), beneficiario,
-- concepto) para mostrarlos en el documento de reserva. Se guardan
-- como texto libre porque el formato varía (varias cuentas, etc.).
-- ============================================================

alter table public.companies add column if not exists datos_bancarios text;

update public.companies
set datos_bancarios = 'IBAN 1: ES76 0182 3240 0902 0190 3282 (BBVA)
IBAN 2: ES53 2100 8361 1002 0004 6230 (CaixaBank)
Concepto: Reserva + número de bastidor'
where code = 'SENSAUTO';
