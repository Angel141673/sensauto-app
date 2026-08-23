import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import ExpenseForm from './ExpenseForm'
import { deleteExpense } from './actions'
import SelectCompanyPrompt from '@/components/SelectCompanyPrompt'

export default async function GastosPage({
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

  const activeCompany = companies.find((c: any) => c.code === empresa)

  if (!activeCompany) {
    return (
      <div className="vehicles-page">
        <h1>Gastos / facturas</h1>
        <SelectCompanyPrompt companies={companies} basePath="/dashboard/gastos" />
      </div>
    )
  }

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, marca, modelo, vin')
    .eq('company_id', activeCompany.id)
    .order('created_at', { ascending: false })

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('id, proveedor, fecha, base, total, created_at, vehicle:vehicles(marca, modelo)')
    .eq('company_id', activeCompany.id)
    .order('created_at', { ascending: false })

  const totalGastos = (expenses ?? []).reduce((acc, e: any) => acc + Number(e.total || 0), 0)

  return (
    <div className="vehicles-page">
      <h1>Gastos / facturas</h1>

      <ExpenseForm companyId={activeCompany.id} companyCode={activeCompany.code} vehicles={vehicles ?? []} />

      <section className="detail-section">
        <h2>Gastos registrados — {activeCompany.name}</h2>
        <p className="form-note">Total acumulado: {totalGastos.toFixed(2)} €</p>

        {error && <p className="login-error">No se han podido cargar los gastos.</p>}

        {!error && (!expenses || expenses.length === 0) && (
          <p className="empty-state">Todavía no hay gastos registrados.</p>
        )}

        <ul className="vehicle-list">
          {expenses?.map((e: any) => (
            <li key={e.id} className="vehicle-card">
              <div className="vehicle-card-main">
                <strong>{e.proveedor || 'Proveedor sin especificar'}</strong>
                <span className="vehicle-card-sub">
                  {e.fecha ? new Date(e.fecha).toLocaleDateString('es-ES') : 'Sin fecha'}
                  {e.vehicle ? ` · ${e.vehicle.marca} ${e.vehicle.modelo}` : ''}
                </span>
              </div>
              <div className="vehicle-card-side">
                <strong>{Number(e.total).toFixed(2)} €</strong>
                <form action={deleteExpense.bind(null, e.id)}>
                  <button type="submit" className="secondary-btn">
                    Eliminar
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
