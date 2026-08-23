-- ============================================================
-- SENSAUTO / SUNAUTO — Esquema inicial (Bloque 1)
-- Cubre: persistencia real, autenticación/usuarios,
--        separación de datos SENSAUTO / SUNAUTO
-- Motor: Postgres (Supabase)
-- ============================================================

-- ------------------------------------------------------------
-- 1. EMPRESAS
-- ------------------------------------------------------------
-- Las dos empresas son datos, no código: así no hay nada
-- hardcodeado y el modelo escala si algún día hay una tercera.
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,        -- 'SENSAUTO' | 'SUNAUTO'
  name        text not null,               -- nombre para mostrar
  created_at  timestamptz not null default now()
);

insert into public.companies (code, name)
values ('SENSAUTO', 'SENSAUTO Motor'), ('SUNAUTO', 'SUNAUTO')
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- 2. PERFILES DE USUARIO
-- ------------------------------------------------------------
-- Extiende auth.users (gestionado por Supabase Auth) con el
-- nombre real que debe mostrarse ("Hola Ángel" / "Hola Vanessa").
-- El nombre NUNCA se escribe en el frontend: sale de aquí.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  created_at  timestamptz not null default now()
);

-- Crea automáticamente el perfil cuando se registra un usuario en Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- 3. MEMBRESÍAS USUARIO-EMPRESA
-- ------------------------------------------------------------
-- Un usuario puede tener acceso a una o varias empresas.
-- Esto es lo que permite el selector SENSAUTO/SUNAUTO y el
-- resumen conjunto sin mezclar datos por accidente.
create table if not exists public.user_companies (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  role        text not null default 'member', -- 'admin' | 'member' (ampliable)
  primary key (user_id, company_id)
);

-- ------------------------------------------------------------
-- 4. FUNCIÓN AUXILIAR DE SEGURIDAD
-- ------------------------------------------------------------
-- Reutilizable por TODAS las tablas futuras (vehículos, clientes,
-- documentos, facturas...) para aplicar la misma regla de
-- segregación por empresa sin repetir lógica.
create or replace function public.user_has_company_access(target_company uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_companies uc
    where uc.user_id = auth.uid()
      and uc.company_id = target_company
  );
$$;

-- ------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.user_companies enable row level security;

-- Cualquier usuario autenticado puede ver el catálogo de empresas
-- (necesario para pintar el selector), pero eso no da acceso a datos.
create policy "companies_select_authenticated"
  on public.companies for select
  to authenticated
  using (true);

-- Un usuario solo ve y edita su propio perfil.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- Un usuario solo ve sus propias membresías (a qué empresas tiene acceso).
create policy "user_companies_select_own"
  on public.user_companies for select
  to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- NOTA PARA BLOQUES SIGUIENTES (vehículos, clientes, documentos,
-- facturas...): cada tabla nueva debe:
--   1) incluir columna company_id uuid references public.companies(id)
--   2) activar row level security
--   3) usar esta política como plantilla:
--
--   create policy "<tabla>_by_company_access"
--     on public.<tabla> for all
--     to authenticated
--     using (public.user_has_company_access(company_id))
--     with check (public.user_has_company_access(company_id));
--
-- Así la segregación SENSAUTO/SUNAUTO es automática y no depende
-- de que cada pantalla "recuerde" filtrar por empresa.
-- ------------------------------------------------------------
