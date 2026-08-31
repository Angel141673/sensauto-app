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
