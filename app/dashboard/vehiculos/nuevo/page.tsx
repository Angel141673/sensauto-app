import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import VehicleForm from '@/components/VehicleForm'
import { createVehicle } from '../actions'
import SelectCompanyPrompt from '@/components/SelectCompanyPrompt'

export default async function NuevoVehiculoPage({
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

  if (companies.length === 0) {
    redirect('/dashboard')
  }

  const defaultCompany = companies.find((c: any) => c.code === empresa)

  if (!defaultCompany) {
    return (
      <div className="vehicles-page">
        <h1>Nuevo vehículo</h1>
        <SelectCompanyPrompt companies={companies} basePath="/dashboard/vehiculos/nuevo" />
      </div>
    )
  }

  return (
    <div className="vehicles-page">
      <h1>Nuevo vehículo</h1>
      <VehicleForm action={createVehicle} companies={companies} defaultCompanyId={defaultCompany.id} />
    </div>
  )
}
