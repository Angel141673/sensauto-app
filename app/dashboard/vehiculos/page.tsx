import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const ESTADO_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  preparacion: 'Preparación',
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
  entregado: 'Entregado',
  posventa: 'Posventa',
}

export default async function VehiculosPage({
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
    .from('vehicles')
    .select('id, marca, modelo, vin, matricula, estado, precio_venta_previsto, company:companies(code)')
    .order('created_at', { ascending: false })

  if (!isAll && activeCompany) {
    query = query.eq('company_id', activeCompany.id)
  }

  if (q && q.trim()) {
    const term = q.trim().replace(/[%_]/g, '')
    query = query.or(`marca.ilike.%${term}%,modelo.ilike.%${term}%,vin.ilike.%${term}%`)
  }

  const { data: vehicles, error } = await query

  return (
    <div className="vehicles-page">
      <div className="vehicles-header">
        <h1>Vehículos</h1>
        {!isAll && activeCompany && (
          <Link
            href={`/dashboard/vehiculos/nuevo?empresa=${activeCompany.code}`}
            className="primary-btn"
          >
            + Nuevo vehículo
          </Link>
        )}
      </div>

      {isAll && (
        <p className="form-note">
          Estás viendo el resumen conjunto de todas tus empresas. Para dar de
          alta un vehículo, elige primero SENSAUTO o SUNAUTO en el selector
          superior.
        </p>
      )}

      <form className="search-bar" action="/dashboard/vehiculos" method="get">
        {empresa && <input type="hidden" name="empresa" value={empresa} />}
        <input
          type="text"
          name="q"
          placeholder="Buscar por marca, modelo o bastidor/VIN…"
          defaultValue={q ?? ''}
        />
        <button type="submit">Buscar</button>
      </form>

      {error && <p className="login-error">No se han podido cargar los vehículos.</p>}

      {!error && (!vehicles || vehicles.length === 0) && (
        <p className="empty-state">
          {q ? 'No hay vehículos que coincidan con la búsqueda.' : 'Todavía no hay vehículos dados de alta.'}
        </p>
      )}

      <ul className="vehicle-list">
        {vehicles?.map((v: any) => (
          <li key={v.id}>
            <Link href={`/dashboard/vehiculos/${v.id}`} className="vehicle-card">
              <div className="vehicle-card-main">
                <strong>
                  {v.marca} {v.modelo}
                </strong>
                <span className="vehicle-card-sub">
                  {v.vin || 'Sin VIN registrado'} {v.matricula ? `· ${v.matricula}` : ''}
                </span>
              </div>
              <div className="vehicle-card-side">
                {isAll && <span className="company-tag">{v.company?.code}</span>}
                <span className={`estado-badge estado-${v.estado}`}>
                  {ESTADO_LABEL[v.estado] ?? v.estado}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
