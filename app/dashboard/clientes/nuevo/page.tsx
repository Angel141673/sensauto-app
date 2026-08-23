import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import ClientForm from '@/components/ClientForm'
import { createClientRecord } from '../actions'

export default async function NuevoClientePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="vehicles-page">
      <h1>Nuevo cliente</h1>
      <ClientForm action={createClientRecord} />
    </div>
  )
}
