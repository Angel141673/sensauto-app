import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import SelectCompanyPrompt from '@/components/SelectCompanyPrompt'

function euro(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export default async function InformesPage({
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

  const { data: memberships } = await supabase
    .from('user_companies')
    .select('company:companies(id, code, name)')
    .eq('user_id', user.id)
  const companies = (memberships ?? []).map((m: any) => m.company).filter(Boolean)
  if (companies.length === 0) redirect('/dashboard')

  if (!empresa) {
    return (
      <div className="vehicles-page">
        <h1>Inversión, márgenes y previsión</h1>
        <SelectCompanyPrompt companies={companies} basePath="/dashboard/informes" showTodas />
      </div>
    )
  }

  const activeCode = empresa
  const isAll = activeCode === 'TODAS'
  const activeCompany = companies.find((c: any) => c.code === activeCode)

  if (!isAll && !activeCompany) {
    return (
      <div className="vehicles-page">
        <h1>Inversión, márgenes y previsión</h1>
        <SelectCompanyPrompt companies={companies} basePath="/dashboard/informes" showTodas />
      </div>
    )
  }

  const companyIds = isAll ? companies.map((c: any) => c.id) : [activeCompany.id]

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, marca, modelo, estado, precio_compra, precio_venta_previsto, precio_venta_real, fecha_venta, company_id')
    .in('company_id', companyIds)

  const { data: expenses } = await supabase
    .from('expenses')
    .select('vehicle_id, total, company_id')
    .in('company_id', companyIds)

  const gastosPorVehiculo = new Map<string, number>()
  let gastosSinVehiculo = 0
  for (const e of expenses ?? []) {
    if (e.vehicle_id) {
      gastosPorVehiculo.set(e.vehicle_id, (gastosPorVehiculo.get(e.vehicle_id) ?? 0) + Number(e.total || 0))
    } else {
      gastosSinVehiculo += Number(e.total || 0)
    }
  }

  let inversionAcumulada = 0
  let margenRealizado = 0
  let previsionPendiente = 0
  let totalGastos = gastosSinVehiculo

  const porMes = new Map<string, number>() // margen realizado agrupado por mes de venta

  for (const v of vehicles ?? []) {
    const gastosVehiculo = gastosPorVehiculo.get(v.id) ?? 0
    totalGastos += gastosVehiculo
    const inversionVehiculo = Number(v.precio_compra || 0) + gastosVehiculo
    inversionAcumulada += inversionVehiculo

    if (v.estado === 'vendido' || v.estado === 'entregado' || v.estado === 'posventa') {
      const margen = Number(v.precio_venta_real || 0) - inversionVehiculo
      margenRealizado += margen

      if (v.fecha_venta) {
        const mes = v.fecha_venta.slice(0, 7) // YYYY-MM
        porMes.set(mes, (porMes.get(mes) ?? 0) + margen)
      }
    } else {
      const previsto = Number(v.precio_venta_previsto || 0) - inversionVehiculo
      previsionPendiente += previsto
    }
  }

  const mesesOrdenados = Array.from(porMes.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))

  return (
    <div className="vehicles-page">
      <h1>Inversión, márgenes y previsión</h1>
      <p className="form-note">
        Herramienta de control y previsión basada en los datos introducidos. No sustituye la
        asesoría fiscal: para el cierre mensual/trimestral y la declaración de REBU, consulta con
        la gestoría con estos números como punto de partida.
      </p>

      <section className="detail-section">
        <h2>Resumen {isAll ? '— todas las empresas' : ''}</h2>
        <dl className="detail-grid">
          <div><dt>Inversión acumulada (vehículos en cartera + vendidos)</dt><dd>{euro(inversionAcumulada)}</dd></div>
          <div><dt>Gastos totales registrados</dt><dd>{euro(totalGastos)}</dd></div>
          <div><dt>Margen realizado (vehículos vendidos)</dt><dd>{euro(margenRealizado)}</dd></div>
          <div><dt>Previsión de margen (resto de vehículos, según precio previsto)</dt><dd>{euro(previsionPendiente)}</dd></div>
        </dl>
      </section>

      <section className="detail-section">
        <h2>Margen realizado por mes</h2>
        {mesesOrdenados.length === 0 && (
          <p className="empty-state">
            Todavía no hay ventas con fecha de venta registrada. Añade la fecha de venta en la
            ficha del vehículo para que aparezca aquí.
          </p>
        )}
        {mesesOrdenados.length > 0 && (
          <ul className="pending-list">
            {mesesOrdenados.map(([mes, margen]) => (
              <li key={mes}>
                {mes} — {euro(margen)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="detail-section">
        <h2>Por vehículo</h2>
        <ul className="vehicle-list">
          {(vehicles ?? []).map((v: any) => {
            const gastosVehiculo = gastosPorVehiculo.get(v.id) ?? 0
            const inversion = Number(v.precio_compra || 0) + gastosVehiculo
            const referencia = v.precio_venta_real ?? v.precio_venta_previsto
            const margen = referencia !== null && referencia !== undefined ? referencia - inversion : null
            return (
              <li key={v.id} className="vehicle-card">
                <div className="vehicle-card-main">
                  <strong>{v.marca} {v.modelo}</strong>
                  <span className="vehicle-card-sub">Inversión: {euro(inversion)}</span>
                </div>
                <div className="vehicle-card-side">
                  <span className={`estado-badge estado-${v.estado}`}>{v.estado}</span>
                  <strong>{margen !== null ? euro(margen) : '—'}</strong>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
