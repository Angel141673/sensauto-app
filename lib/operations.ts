import type { createClient } from './supabaseServer'

// Toda factura (public.invoices) cuelga de una operación (cliente +
// vehículo), igual que el contrato. Antes de este fix, el contrato de
// reserva creaba la operación sin "company_id" (columna NOT NULL) — el
// insert fallaba en silencio y el vehículo nunca avanzaba de estado.
export async function getOrCreateOperationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: { vehicleId: string; clientId: string; companyId: string; userId: string }
): Promise<string> {
  const { vehicleId, clientId, companyId, userId } = params

  const { data: existing } = await supabase
    .from('operations')
    .select('id')
    .eq('vehicle_id', vehicleId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('operations')
    .insert({ company_id: companyId, vehicle_id: vehicleId, client_id: clientId, created_by: userId })
    .select('id')
    .single()

  if (error || !created) {
    throw new Error('No se ha podido crear la operación para este cliente y vehículo.')
  }
  return created.id
}
