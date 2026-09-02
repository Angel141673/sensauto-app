'use server'

import { createClient as createSupabaseClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function readClientFields(formData: FormData) {
  return {
    nombre: String(formData.get('nombre') ?? '').trim(),
    telefono: (formData.get('telefono') as string) || null,
    email: (formData.get('email') as string) || null,
    dni_nif: (formData.get('dni_nif') as string) || null,
    direccion: (formData.get('direccion') as string) || null,
    codigo_postal: (formData.get('codigo_postal') as string) || null,
    provincia: (formData.get('provincia') as string) || null,
    notas: (formData.get('notas') as string) || null,
  }
}

export async function createClientRecord(formData: FormData) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fields = readClientFields(formData)
  if (!fields.nombre) {
    throw new Error('El nombre es obligatorio.')
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({ ...fields, created_by: user.id })
    .select('id')
    .single()

  if (error) {
    throw new Error('No se ha podido guardar el cliente. Inténtalo de nuevo.')
  }

  revalidatePath('/dashboard/clientes')
  redirect(`/dashboard/clientes/${data.id}`)
}

export async function updateClientRecord(clientId: string, formData: FormData) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fields = readClientFields(formData)

  const { error } = await supabase.from('clients').update(fields).eq('id', clientId)

  if (error) {
    throw new Error('No se ha podido actualizar el cliente. Inténtalo de nuevo.')
  }

  revalidatePath(`/dashboard/clientes/${clientId}`)
  revalidatePath('/dashboard/clientes')
  redirect(`/dashboard/clientes/${clientId}`)
}

export async function linkVehicleToClient(clientId: string, formData: FormData) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const vehicle_id = String(formData.get('vehicle_id') ?? '')
  const estado = String(formData.get('estado') ?? 'contacto')

  if (!vehicle_id) {
    throw new Error('Selecciona un vehículo para vincular.')
  }

  // La empresa de la operación la asigna automáticamente un trigger en base
  // de datos a partir del vehículo — nunca se elige a mano aquí.
  const { error } = await supabase.from('operations').insert({
    vehicle_id,
    client_id: clientId,
    estado,
    created_by: user.id,
  })

  if (error) {
    throw new Error('No se ha podido vincular el vehículo. Inténtalo de nuevo.')
  }

  revalidatePath(`/dashboard/clientes/${clientId}`)
  revalidatePath('/dashboard/vehiculos')
}

// Quita el vínculo cliente-vehículo (borra la operación), no el vehículo
// ni sus documentos — solo lo saca de la lista de "Vehículos vinculados"
// de este cliente. Si ya tiene un contrato firmado asociado, la base de
// datos rechaza el borrado (no se pierde el historial de firma).
export async function unlinkVehicleFromClient(operationId: string, formData: FormData) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clientId = String(formData.get('client_id') ?? '')

  const { error } = await supabase.from('operations').delete().eq('id', operationId)

  if (error) {
    if (error.code === '23503') {
      throw new Error('No se puede quitar: este vehículo tiene un contrato firmado vinculado.')
    }
    throw new Error('No se ha podido quitar el vínculo. Inténtalo de nuevo.')
  }

  revalidatePath(`/dashboard/clientes/${clientId}`)
  revalidatePath('/dashboard/vehiculos')
}

export async function updateOperationEstado(operationId: string, formData: FormData) {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const estado = String(formData.get('estado') ?? '')
  const clientId = String(formData.get('client_id') ?? '')

  const { error } = await supabase.from('operations').update({ estado }).eq('id', operationId)

  if (error) {
    throw new Error('No se ha podido actualizar el estado de la operación.')
  }

  revalidatePath(`/dashboard/clientes/${clientId}`)
}
