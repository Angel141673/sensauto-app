import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let query = supabase
    .from('clients')
    .select('id, nombre, telefono, email')
    .order('created_at', { ascending: false })

  if (q && q.trim()) {
    const term = q.trim().replace(/[%_]/g, '')
    query = query.or(`nombre.ilike.%${term}%,telefono.ilike.%${term}%,dni_nif.ilike.%${term}%`)
  }

  const { data: clients, error } = await query

  return (
    <div className="vehicles-page">
      <div className="vehicles-header">
        <h1>Clientes</h1>
        <Link href="/dashboard/clientes/nuevo" className="primary-btn">
          + Nuevo cliente
        </Link>
      </div>

      <p className="form-note">
        Los clientes son compartidos entre SENSAUTO y SUNAUTO — un mismo cliente puede tener
        operaciones en ambas empresas.
      </p>

      <form className="search-bar" action="/dashboard/clientes" method="get">
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
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
