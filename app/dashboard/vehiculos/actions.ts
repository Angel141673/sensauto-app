'use server'

import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type VehicleFormState = {
  error?: string
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
    precio_compra: formData.get('precio_compra') ? Number(formData.get('precio_compra')) : null,
    precio_venta_previsto: formData.get('precio_venta_previsto')
      ? Number(formData.get('precio_venta_previsto'))
      : null,
    precio_venta_real: formData.get('precio_venta_real')
      ? Number(formData.get('precio_venta_real'))
      : null,
    fecha_venta: (formData.get('fecha_venta') as string) || null,
    estado: String(formData.get('estado') ?? 'entrada'),
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
