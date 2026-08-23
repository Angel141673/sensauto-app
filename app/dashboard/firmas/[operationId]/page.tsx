import { createClient } from '@/lib/supabaseServer'
import { redirect, notFound } from 'next/navigation'
import SignatureCaptureForm from '../SignatureCaptureForm'

export default async function FirmarPage({
  params,
}: {
  params: Promise<{ operationId: string }>
}) {
  const { operationId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: operation, error } = await supabase
    .from('operations')
    .select('id, company_id, client:clients(id, nombre), vehicle:vehicles(marca, modelo), company:companies(name)')
    .eq('id', operationId)
    .single()

  if (error || !operation) notFound()

  return (
    <div className="vehicles-page">
      <h1>Firmar contrato</h1>
      <SignatureCaptureForm
        companyId={operation.company_id}
        companyName={(operation.company as any)?.name ?? ''}
        operationId={operation.id}
        clientId={(operation.client as any)?.id}
        clientNombre={(operation.client as any)?.nombre ?? ''}
        vehicleLabel={`${(operation.vehicle as any)?.marca ?? ''} ${(operation.vehicle as any)?.modelo ?? ''}`}
      />
    </div>
  )
}
