import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; q?: string }>
}) {
  const { empresa, q } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('user_companies')
    .select('company:companies(id, code, name)')
    .eq('user_id', user.id)

  const companies = (memberships ?? []).map((m: any) => m.company).filter(Boolean)
  const activeCode = empresa ?? companies[0]?.code
  const activeCompany = companies.find((c: any) => c.code === activeCode)
  const isAll = activeCode === 'TODAS'

  let query = supabase
    .from('clients')
    .select('id, nombre, telefono, email, company:companies(code)')
    .order('created_at', { ascending: false })

  if (!isAll && activeCompany) {
    query = query.eq('company_id', activeCompany.id)
  }

  if (q && q.trim()) {
    const term = q.trim().replace(/[%_]/g, '')
    query = query.or(`nombre.ilike.%${term}%,telefono.ilike.%${term}%,dni_nif.ilike.%${term}%`)
  }

  const { data: clients, error } = await query

  return (
    <div className="vehicles-page">
      <div className="vehicles-header">
        <h1>Clientes</h1>
        {!isAll && activeCompany && (
          <Link href={`/dashboard/clientes/nuevo?empresa=${activeCompany.code}`} className="primary-btn">
            + Nuevo cliente
          </Link>
        )}
      </div>

      {isAll && (
        <p className="form-note">
          Resumen conjunto de todas tus empresas. Para dar de alta un cliente,
          elige primero SENSAUTO o SUNAUTO en el selector superior.
        </p>
      )}

      <form className="search-bar" action="/dashboard/clientes" method="get">
        {empresa && <input type="hidden" name="empresa" value={empresa} />}
        <input type="text" name="q" placeholder="Buscar por nombre, teléfono o DNI/NIF…" defaultValue={q ?? ''} />
        <button type="submit">Buscar</button>
      </form>

      {error && <p className="login-error">No se han podido cargar los clientes.</p>}

      {!error && (!clients || clients.length === 0) && (
        <p className="empty-state">
          {q ? 'No hay clientes que coincidan con la búsqueda.' : 'Todavía no hay clientes dados de alta.'}
        </p>
      )}

      <ul className="vehicle-list">
        {clients?.map((c: any) => (
          <li key={c.id}>
            <Link href={`/dashboard/clientes/${c.id}`} className="vehicle-card">
              <div className="vehicle-card-main">
                <strong>{c.nombre}</strong>
                <span className="vehicle-card-sub">
                  {c.telefono || 'Sin teléfono'} {c.email ? `· ${c.email}` : ''}
                </span>
              </div>
              {isAll && <span className="company-tag">{c.company?.code}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
