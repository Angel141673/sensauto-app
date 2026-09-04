'use server'

import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { analyzeVehiclePurchaseInvoice, type VehiclePurchaseAnalysis } from '@/lib/anthropicInvoice'

export type VehicleFormState = {
  error?: string
}

export type AnalyzeVehicleState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  analysis?: VehiclePurchaseAnalysis
}

// Analiza la foto de la factura de compra con IA y devuelve una PROPUESTA.
// No guarda nada: el usuario revisa/edita los campos y confirma con el
// formulario normal (createVehicle).
export async function analyzeVehiclePurchaseWithAI(
  prevState: AnalyzeVehicleState,
  formData: FormData
): Promise<AnalyzeVehicleState> {
  const file = formData.get('file') as File | null

  if (!file || file.size === 0) {
    return { status: 'error', message: 'Selecciona primero una foto de la factura de compra.' }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')
    const analysis = await analyzeVehiclePurchaseInvoice(base64, file.type || 'image/jpeg')
    return { status: 'success', analysis }
  } catch (err: any) {
    return {
      status: 'error',
      message: err?.message ?? 'No se ha podido analizar la factura con la IA.',
    }
  }
}

function readVehicleFields(formData: FormData) {
  return {
    company_id: String(formData.get('company_id') ?? ''),
    marca: String(formData.get('marca') ?? '').trim(),
    modelo: String(formData.get('modelo') ?? '').trim(),
    vin: (formData.get('vin') ? String(formData.get('vin')).trim() : null) || null,
    matricula: (formData.get('matricula') ? String(formData.get('matricula')).trim() : null) || null,
    anio: formData.get('anio') ? Number(formData.get('anio')) : null,
    km: formData.get('km') ? Number(formData.get('km')) : null,
    combustible: (formData.get('combustible') as string) || null,
    transmision: (formData.get('transmision') as string) || null,
    color: (formData.get('color') as string) || null,
    motor: (formData.get('motor') as string) || null,
    fecha_matriculacion: (formData.get('fecha_matriculacion') as string) || null,
    precio_compra: formData.get('precio_compra') ? Number(formData.get('precio_compra')) : null,
    precio_venta_previsto: formData.get('precio_venta_previsto')
      ? Number(formData.get('precio_venta_previsto'))
      : null,
    precio_venta_real: formData.get('precio_venta_real')
      ? Number(formData.get('precio_venta_real'))
      : null,
    fecha_venta: (formData.get('fecha_venta') as string) || null,
    estado: String(formData.get('estado') ?? 'entrada'),
    numero_llave: (formData.get('numero_llave') ? String(formData.get('numero_llave')).trim() : null) || null,
    notas: (formData.get('notas') as string) || null,
  }
}

export async function createVehicle(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fields = readVehicleFields(formData)

  if (!fields.company_id || !fields.marca || !fields.modelo) {
    throw new Error('Empresa, marca y modelo son obligatorios.')
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert({ ...fields, created_by: user.id })
    .select('id')
    .single()

  if (error) {
    // Índice único VIN+empresa: mensaje claro en vez de error crudo de Postgres.
    if (error.code === '23505') {
      throw new Error('Ya existe un vehículo con ese bastidor/VIN en esta empresa.')
    }
    throw new Error('No se ha podido guardar el vehículo. Inténtalo de nuevo.')
  }

  revalidatePath('/dashboard/vehiculos')
  redirect(`/dashboard/vehiculos/${data.id}`)
}

export async function updateVehicle(vehicleId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fields = readVehicleFields(formData)

  const { error } = await supabase
    .from('vehicles')
    .update(fields)
    .eq('id', vehicleId)

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ya existe un vehículo con ese bastidor/VIN en esta empresa.')
    }
    throw new Error('No se ha podido actualizar el vehículo. Inténtalo de nuevo.')
  }

  revalidatePath(`/dashboard/vehiculos/${vehicleId}`)
  revalidatePath('/dashboard/vehiculos')
  redirect(`/dashboard/vehiculos/${vehicleId}`)
}

export type UploadPhotoState = {
  status: 'idle' | 'error'
  message?: string
}

// Solo se conserva una foto por vehículo: al subir una nueva se borra la
// anterior (si había) tanto de storage como el path guardado en la fila.
export async function uploadVehiclePhoto(
  vehicleId: string,
  companyId: string,
  previousFotoPath: string | null,
  prevState: UploadPhotoState,
  formData: FormData
): Promise<UploadPhotoState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { status: 'error', message: 'Selecciona una foto.' }
  }
  if (!file.type.startsWith('image/')) {
    return { status: 'error', message: 'El archivo debe ser una imagen.' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${companyId}/${vehicleId}/${randomUUID()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('vehicle-photos')
    .upload(storagePath, buffer, { contentType: file.type })

  if (uploadError) {
    return { status: 'error', message: 'No se ha podido subir la foto. Inténtalo de nuevo.' }
  }

  const { error: updateError } = await supabase
    .from('vehicles')
    .update({ foto_path: storagePath })
    .eq('id', vehicleId)

  if (updateError) {
    await supabase.storage.from('vehicle-photos').remove([storagePath])
    return { status: 'error', message: 'No se ha podido guardar la foto. Inténtalo de nuevo.' }
  }

  if (previousFotoPath) {
    await supabase.storage.from('vehicle-photos').remove([previousFotoPath])
  }

  revalidatePath(`/dashboard/vehiculos/${vehicleId}`)
  revalidatePath('/dashboard/vehiculos')
  return { status: 'idle' }
}

export type DeleteVehicleState = {
  status: 'idle' | 'error'
  message?: string
  blockedBySignature?: boolean
}

// Elimina el vehículo entero (para altas hechas por error) junto con todo
// lo que cuelga de él: gastos, documentos generales, ficha técnica y su
// propia foto. Las operaciones (vínculos con clientes) se borran primero
// — si alguna tiene ya un contrato firmado, la base de datos rechaza el
// borrado ahí mismo y no se toca nada más, protegiendo el historial.
// Devuelve el motivo en vez de lanzar una excepción, para que se muestre
// en pantalla en lugar de la página genérica de error. Con force=true
// (segunda confirmación explícita en pantalla) borra también las firmas
// de sus operaciones, de forma permanente.
export async function deleteVehicle(
  vehicleId: string,
  prevState: DeleteVehicleState,
  formData: FormData
): Promise<DeleteVehicleState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const force = formData.get('force') === 'true'

  if (force) {
    const { data: ops } = await supabase.from('operations').select('id').eq('vehicle_id', vehicleId)
    const opIds = (ops ?? []).map((o) => o.id)
    if (opIds.length) {
      const { data: sigs } = await supabase.from('signatures').select('storage_path').in('operation_id', opIds)
      if (sigs?.length) {
        await supabase.storage.from('firmas').remove(sigs.map((s) => s.storage_path))
      }
      await supabase.from('signatures').delete().in('operation_id', opIds)
    }
  }

  const { error: opsError } = await supabase.from('operations').delete().eq('vehicle_id', vehicleId)
  if (opsError) {
    if (opsError.code === '23503') {
      return {
        status: 'error',
        blockedBySignature: true,
        message: 'No se puede eliminar: este vehículo tiene un contrato firmado. Quita antes el vínculo desde la ficha del cliente.',
      }
    }
    return { status: 'error', message: 'No se ha podido eliminar el vehículo. Inténtalo de nuevo.' }
  }

  await supabase.from('expenses').delete().eq('vehicle_id', vehicleId)

  const { data: vehicleDocs } = await supabase
    .from('vehicle_documents')
    .select('storage_path')
    .eq('vehicle_id', vehicleId)
  if (vehicleDocs?.length) {
    await supabase.storage.from('vehicle-documents').remove(vehicleDocs.map((d) => d.storage_path))
  }

  const { data: generalDocs } = await supabase.from('documents').select('storage_path').eq('vehicle_id', vehicleId)
  if (generalDocs?.length) {
    await supabase.storage.from('documentos').remove(generalDocs.map((d) => d.storage_path))
  }
  const { error: docsError } = await supabase.from('documents').delete().eq('vehicle_id', vehicleId)
  if (docsError) {
    return {
      status: 'error',
      message: 'No se puede eliminar: alguno de sus documentos está vinculado a una firma. Revísalo antes de continuar.',
    }
  }

  const { data: vehicle } = await supabase.from('vehicles').select('foto_path').eq('id', vehicleId).single()
  if (vehicle?.foto_path) {
    await supabase.storage.from('vehicle-photos').remove([vehicle.foto_path])
  }

  const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId)
  if (error) {
    return { status: 'error', message: 'No se ha podido eliminar el vehículo. Inténtalo de nuevo.' }
  }

  revalidatePath('/dashboard/vehiculos')
  redirect('/dashboard/vehiculos')
}

export async function deleteVehiclePhoto(vehicleId: string, fotoPath: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.storage.from('vehicle-photos').remove([fotoPath])
  await supabase.from('vehicles').update({ foto_path: null }).eq('id', vehicleId)

  revalidatePath(`/dashboard/vehiculos/${vehicleId}`)
  revalidatePath('/dashboard/vehiculos')
}
