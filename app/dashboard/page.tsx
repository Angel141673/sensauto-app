import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SelectCompanyPrompt from '@/components/SelectCompanyPrompt'
import { TIPOS_CLAVE } from '@/lib/vehicleDocuments'

const ESTADO_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  preparacion: 'Preparación',
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
  entregado: 'Entregado',
  posventa: 'Posventa',
}

function euro(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>
}) {
  const { empresa } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()
  const displayName = profile?.full_name ?? user.email ?? 'usuario'

  const { data: memberships } = await supabase
    .from('user_companies')
    .select('company:companies(id, code, name)')
    .eq('user_id', user.id)
  const companies = (memberships ?? []).map((m: any) => m.company).filter(Boolean)

  if (!empresa) {
    return (
      <div className="vehicles-page">
        <h1>Hola, {displayName}</h1>
        <SelectCompanyPrompt companies={companies} basePath="/dashboard" showTodas />
      </div>
    )
  }

  const activeCode = empresa
  const activeCompany = companies.find((c: any) => c.code === activeCode)
  const isAll = activeCode === 'TODAS'
  const companyIds = companies.map((c: any) => c.id)

  let vq = supabase
    .from('vehicles')
    .select('id, marca, modelo, vin, matricula, estado, precio_compra, fecha_venta, foto_path, created_at, company:companies(code)')
    .order('created_at', { ascending: false })
  if (!isAll && activeCompany) {
    vq = vq.eq('company_id', activeCompany.id)
  } else if (isAll) {
    vq = vq.in('company_id', companyIds)
  }
  const { data: vehiclesRaw } = await vq
  const vehicles = vehiclesRaw ?? []

  const enStock = vehicles.filter((v: any) => v.estado !== 'vendido' && v.estado !== 'entregado')
  const disponibles = vehicles.filter((v: any) => v.estado === 'disponible')
  const reservados = vehicles.filter((v: any) => v.estado === 'reservado')
  const inversionStock = enStock.reduce((acc: number, v: any) => acc + Number(v.precio_compra || 0), 0)

  const now = new Date()
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
  const vendidosEsteMes = vehicles.filter(
    (v: any) =>
      (v.estado === 'vendido' || v.estado === 'entregado') &&
      v.fecha_venta &&
      new Date(v.fecha_venta) >= inicioMes
  )

  const stockIds = enStock.map((v: any) => v.id)
  const { data: docs } = stockIds.length
    ? await supabase.from('vehicle_documents').select('vehicle_id, tipo_documento').in('vehicle_id', stockIds)
    : { data: [] as any[] }

  const tiposByVehicle = new Map<string, Set<string>>()
  ;(docs ?? []).forEach((d: any) => {
    if (!tiposByVehicle.has(d.vehicle_id)) tiposByVehicle.set(d.vehicle_id, new Set())
    tiposByVehicle.get(d.vehicle_id)!.add(d.tipo_documento)
  })
  const documentacionIncompleta = enStock.filter((v: any) => {
    const tipos = tiposByVehicle.get(v.id) ?? new Set()
    return TIPOS_CLAVE.some((t) => !tipos.has(t))
  })

  const { count: clientesCount } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })

  const inicioMesStr = inicioMes.toISOString().slice(0, 10)
  let eq = supabase.from('expenses').select('total').gte('fecha', inicioMesStr)
  eq = !isAll && activeCompany ? eq.eq('company_id', activeCompany.id) : eq.in('company_id', companyIds)
  const { data: gastosMes } = await eq
  const totalGastosMes = (gastosMes ?? []).reduce((acc: number, e: any) => acc + Number(e.total || 0), 0)

  const recientes = vehicles.slice(0, 5)
  const recientesConFoto = await Promise.all(
    recientes.map(async (v: any) => {
      if (!v.foto_path) return { ...v, fotoUrl: null }
      const { data } = await supabase.storage.from('vehicle-photos').createSignedUrl(v.foto_path, 60 * 5)
      return { ...v, fotoUrl: data?.signedUrl ?? null }
    })
  )

  return (
    <div className="vehicles-page">
      <h1>Hola, {displayName}</h1>
      <p className="form-note">
        Resumen {isAll ? 'de todas tus empresas' : activeCompany ? `de ${activeCompany.name}` : ''}
      </p>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{enStock.length}</span>
          <span className="stat-label">Vehículos en stock</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{disponibles.length}</span>
          <span className="stat-label">Disponibles</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{reservados.length}</span>
          <span className="stat-label">Reservados</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{vendidosEsteMes.length}</span>
          <span className="stat-label">Vendidos este mes</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{euro(inversionStock)}</span>
          <span className="stat-label">Inversión en stock</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{euro(totalGastosMes)}</span>
          <span className="stat-label">Gastos este mes</span>
        </div>
        <div className={documentacionIncompleta.length > 0 ? 'stat-card stat-card-warn' : 'stat-card'}>
          <span className="stat-value">{documentacionIncompleta.length}</span>
          <span className="stat-label">Documentación incompleta</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{clientesCount ?? 0}</span>
          <span className="stat-label">Clientes (todas las empresas)</span>
        </div>
      </div>

      <section className="detail-section">
        <h2>Vehículos recientes</h2>
        {recientesConFoto.length === 0 && <p className="empty-state">Todavía no hay vehículos dados de alta.</p>}
        {recientesConFoto.length > 0 && (
          <ul className="vehicle-list">
            {recientesConFoto.map((v: any) => (
              <li key={v.id}>
                <Link href={`/dashboard/vehiculos/${v.id}`} className="vehicle-card">
                  {v.fotoUrl ? (
                    <img src={v.fotoUrl} alt="" className="vehicle-card-thumb" />
                  ) : (
                    <div className="vehicle-card-thumb vehicle-card-thumb-empty" aria-hidden="true" />
                  )}
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
        )}
        <Link
          href={`/dashboard/vehiculos?empresa=${activeCode}`}
          className="secondary-btn"
          style={{ display: 'inline-block', marginTop: 14 }}
        >
          Ver todos los vehículos
        </Link>
      </section>
    </div>
  )
}
