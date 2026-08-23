import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import ClientForm from '@/components/ClientForm'
import { createClientRecord } from '../actions'
import SelectCompanyPrompt from '@/components/SelectCompanyPrompt'

export default async function NuevoClientePage({
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

  const defaultCompany = companies.find((c: any) => c.code === empresa)

  if (!defaultCompany) {
    return (
      <div className="vehicles-page">
        <h1>Nuevo cliente</h1>
        <SelectCompanyPrompt companies={companies} basePath="/dashboard/clientes/nuevo" />
      </div>
    )
  }

  return (
    <div className="vehicles-page">
      <h1>Nuevo cliente</h1>
      <ClientForm action={createClientRecord} companies={companies} defaultCompanyId={defaultCompany.id} />
    </div>
  )
}
