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

export type DeleteState = {
  status: 'idle' | 'error'
  message?: string
  blockedBySignature?: boolean
}

// Elimina el cliente entero (para altas hechas por error) junto con sus
// documentos generales. Las operaciones (vínculos con vehículos) se borran
// primero — si alguna tiene ya un contrato firmado, la base de datos
// rechaza el borrado ahí mismo y no se toca nada más, igual que al
// eliminar un vehículo. Devuelve el motivo en vez de lanzar una excepción,
// para que se muestre en pantalla en lugar de la página genérica de error.
// Con force=true (segunda confirmación explícita en pantalla) borra
// también las firmas de sus operaciones, de forma permanente.
export async function deleteClient(
  clientId: string,
  prevState: DeleteState,
  formData: FormData
): Promise<DeleteState> {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const force = formData.get('force') === 'true'

  if (force) {
    const { data: ops } = await supabase.from('operations').select('id').eq('client_id', clientId)
    const opIds = (ops ?? []).map((o) => o.id)
    if (opIds.length) {
      const { data: sigs } = await supabase.from('signatures').select('storage_path').in('operation_id', opIds)
      if (sigs?.length) {
        await supabase.storage.from('firmas').remove(sigs.map((s) => s.storage_path))
      }
      await supabase.from('signatures').delete().in('operation_id', opIds)
    }
  }

  const { error: opsError } = await supabase.from('operations').delete().eq('client_id', clientId)
  if (opsError) {
    if (opsError.code === '23503') {
      return {
        status: 'error',
        blockedBySignature: true,
        message: 'No se puede eliminar: este cliente tiene un contrato firmado. Quita antes esos vínculos con el vehículo.',
      }
    }
    return { status: 'error', message: 'No se ha podido eliminar el cliente. Inténtalo de nuevo.' }
  }

  const { data: vehicleDocs } = await supabase
    .from('vehicle_documents')
    .select('storage_path')
    .eq('client_id', clientId)
  if (vehicleDocs?.length) {
    await supabase.storage.from('vehicle-documents').remove(vehicleDocs.map((d) => d.storage_path))
    await supabase.from('vehicle_documents').delete().eq('client_id', clientId)
  }

  const { data: docs } = await supabase.from('documents').select('storage_path').eq('client_id', clientId)
  if (docs?.length) {
    await supabase.storage.from('documentos').remove(docs.map((d) => d.storage_path))
  }
  const { error: docsError } = await supabase.from('documents').delete().eq('client_id', clientId)
  if (docsError) {
    return { status: 'error', message: 'No se puede eliminar: alguno de sus documentos está vinculado a una firma.' }
  }

  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) {
    return { status: 'error', message: 'No se ha podido eliminar el cliente. Inténtalo de nuevo.' }
  }

  revalidatePath('/dashboard/clientes')
  redirect('/dashboard/clientes')
}

export type QuickClientState = {
  status: 'idle' | 'error'
  message?: string
  client?: { id: string; nombre: string }
}

// Alta rápida de cliente desde un modal de generación de documentos
// (presupuesto, contrato...) — a diferencia de createClientRecord no
// redirige, para poder seleccionar el cliente recién creado sin salir
// de la ficha del vehículo.
export async function createQuickClient(
  prevState: QuickClientState,
  formData: FormData
): Promise<QuickClientState> {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const nombre = String(formData.get('nombre') ?? '').trim()
  if (!nombre) {
    return { status: 'error', message: 'El nombre es obligatorio.' }
  }

  const fields = readClientFields(formData)

  const { data, error } = await supabase
    .from('clients')
    .insert({ ...fields, nombre, created_by: user.id })
    .select('id, nombre')
    .single()

  if (error) {
    return { status: 'error', message: 'No se ha podido guardar el cliente. Inténtalo de nuevo.' }
  }

  return { status: 'idle', client: data }
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
// datos rechaza el borrado (no se pierde el historial de firma). Devuelve
// el motivo en vez de lanzar una excepción, para mostrarlo en pantalla.
export async function unlinkVehicleFromClient(
  operationId: string,
  prevState: DeleteState,
  formData: FormData
): Promise<DeleteState> {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clientId = String(formData.get('client_id') ?? '')

  const { error } = await supabase.from('operations').delete().eq('id', operationId)

  if (error) {
    if (error.code === '23503') {
      return { status: 'error', message: 'No se puede quitar: este vehículo tiene un contrato firmado vinculado.' }
    }
    return { status: 'error', message: 'No se ha podido quitar el vínculo. Inténtalo de nuevo.' }
  }

  revalidatePath(`/dashboard/clientes/${clientId}`)
  revalidatePath('/dashboard/vehiculos')
  return { status: 'idle' }
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
