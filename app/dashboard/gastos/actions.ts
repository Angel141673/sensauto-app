'use server'

import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createHash, randomUUID } from 'crypto'
import { analyzeInvoiceImage, type InvoiceAnalysis } from '@/lib/anthropicInvoice'

export type AnalyzeState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  analysis?: InvoiceAnalysis
}

// Analiza la foto con la IA (Claude Haiku 4.5) y devuelve una PROPUESTA.
// No guarda nada: el usuario revisa/edita los campos y confirma con el
// formulario normal (createExpense), igual que antes con el OCR gratuito.
export async function analyzeInvoiceWithAI(
  prevState: AnalyzeState,
  formData: FormData
): Promise<AnalyzeState> {
  const file = formData.get('file') as File | null

  if (!file || file.size === 0) {
    return { status: 'error', message: 'Selecciona primero una foto de la factura.' }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')
    const analysis = await analyzeInvoiceImage(base64, file.type || 'image/jpeg')
    return { status: 'success', analysis }
  } catch (err: any) {
    return {
      status: 'error',
      message: err?.message ?? 'No se ha podido analizar la factura con la IA.',
    }
  }
}

export type ExpenseState = {
  status: 'idle' | 'duplicate_file' | 'duplicate_content' | 'error' | 'success'
  message?: string
}

export async function createExpense(prevState: ExpenseState, formData: FormData): Promise<ExpenseState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const company_id = String(formData.get('company_id') ?? '')
  const vehicle_id = (formData.get('vehicle_id') as string) || null
  const proveedor = (formData.get('proveedor') as string) || null
  const fecha = (formData.get('fecha') as string) || null
  const base = formData.get('base') ? Number(formData.get('base')) : null
  const total = formData.get('total') ? Number(formData.get('total')) : null
  const notas = (formData.get('notas') as string) || null
  const file = formData.get('file') as File | null
  const confirmarDuplicadoArchivo = formData.get('confirmar_duplicado_archivo') === 'true'
  const confirmarDuplicadoContenido = formData.get('confirmar_duplicado_contenido') === 'true'

  if (!company_id || !total) {
    return { status: 'error', message: 'Empresa y total son obligatorios.' }
  }

  let document_id: string | null = null

  if (file && file.size > 0) {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const hash = createHash('sha256').update(buffer).digest('hex')

    if (!confirmarDuplicadoArchivo) {
      const { data: existingFile } = await supabase
        .from('documents')
        .select('id, nombre_archivo, created_at')
        .eq('company_id', company_id)
        .eq('hash_sha256', hash)
        .limit(1)
        .maybeSingle()

      if (existingFile) {
        return {
          status: 'duplicate_file',
          message: `Esta foto/archivo ya se subió antes como "${existingFile.nombre_archivo}" (${new Date(
            existingFile.created_at
          ).toLocaleDateString('es-ES')}). ¿Confirmas que quieres subirla de todas formas?`,
        }
      }
    }

    const storagePath = `${company_id}/${randomUUID()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(storagePath, buffer, { contentType: file.type || undefined })

    if (uploadError) {
      return { status: 'error', message: 'No se ha podido subir la foto de la factura.' }
    }

    const { data: docRow, error: docError } = await supabase
      .from('documents')
      .insert({
        company_id,
        vehicle_id,
        tipo: 'factura',
        nombre_archivo: file.name,
        storage_path: storagePath,
        mime_type: file.type || null,
        tamano_bytes: file.size,
        hash_sha256: hash,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (docError) {
      await supabase.storage.from('documentos').remove([storagePath])
      return { status: 'error', message: 'No se ha podido registrar el documento de la factura.' }
    }

    document_id = docRow.id
  }

  // Duplicado por contenido: mismo proveedor + fecha + total en la misma
  // empresa, aunque la foto sea distinta (por ejemplo, dos fotos de la
  // misma factura en papel).
  if (!confirmarDuplicadoContenido && proveedor && fecha) {
    const { data: existingContent } = await supabase
      .from('expenses')
      .select('id, created_at')
      .eq('company_id', company_id)
      .eq('proveedor', proveedor)
      .eq('fecha', fecha)
      .eq('total', total)
      .limit(1)
      .maybeSingle()

    if (existingContent) {
      return {
        status: 'duplicate_content',
        message: `Ya existe un gasto de "${proveedor}" con fecha ${fecha} y total ${total} €. ¿Confirmas que quieres guardarlo igualmente?`,
      }
    }
  }

  const { error: insertError } = await supabase.from('expenses').insert({
    company_id,
    vehicle_id,
    document_id,
    proveedor,
    fecha,
    base,
    total,
    total_confirmado: true, // el usuario ha revisado el formulario antes de enviarlo
    notas,
    created_by: user.id,
  })

  if (insertError) {
    return { status: 'error', message: 'No se ha podido guardar el gasto. Inténtalo de nuevo.' }
  }

  revalidatePath('/dashboard/gastos')
  if (vehicle_id) revalidatePath(`/dashboard/vehiculos/${vehicle_id}`)

  return { status: 'success', message: 'Gasto guardado correctamente.' }
}

export async function deleteExpense(expenseId: string) {
  const supabase = await createClient()
  await supabase.from('expenses').delete().eq('id', expenseId)
  revalidatePath('/dashboard/gastos')
}

// Busca un vehículo por VIN dentro de una empresa. Se usa desde el
// formulario para proponer (nunca fijar directamente) el vínculo
// automático cuando el OCR detecta un bastidor en la foto.
export async function findVehicleByVin(company_id: string, vin: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('vehicles')
    .select('id, marca, modelo, vin')
    .eq('company_id', company_id)
    .eq('vin', vin.toUpperCase().trim())
    .maybeSingle()
  return data
}

// Crea un vehículo mínimo a partir de un VIN detectado en una factura sin
// coincidencia previa. Marca y modelo no aparecen casi nunca en la factura,
// así que se guardan como "Pendiente" hasta que alguien los edite en la
// ficha del vehículo. Requiere confirmación explícita del usuario (no se
// llama nunca de forma automática sin que él pulse el botón).
export async function createVehicleFromVin(company_id: string, vin: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      company_id,
      marca: 'Pendiente',
      modelo: 'Pendiente',
      vin: vin.toUpperCase().trim(),
      created_by: user.id,
    })
    .select('id, marca, modelo, vin')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ya existe un vehículo con ese bastidor/VIN en esta empresa.')
    }
    throw new Error('No se ha podido crear el vehículo. Inténtalo de nuevo.')
  }

  revalidatePath('/dashboard/vehiculos')
  return data
}

