'use server'

import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createHash } from 'crypto'
import { TIPOS_FACTURA_PROTEGIDA } from '@/lib/documents'

export type UploadState = {
  status: 'idle' | 'duplicate' | 'error' | 'success'
  message?: string
}

async function fileToHash(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

// Primer intento de subida: si detecta un archivo idéntico ya
// guardado en la misma empresa, NO lo sube en silencio — devuelve
// un aviso para que el usuario confirme, igual que con el OCR.
export async function uploadDocument(
  prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const file = formData.get('file') as File | null
  const company_id = String(formData.get('company_id') ?? '')
  const tipo = String(formData.get('tipo') ?? '')
  const vehicle_id = (formData.get('vehicle_id') as string) || null
  const client_id = (formData.get('client_id') as string) || null
  const notas = (formData.get('notas') as string) || null
  const confirmarDuplicado = formData.get('confirmar_duplicado') === 'true'

  if (!file || file.size === 0) {
    return { status: 'error', message: 'Selecciona un archivo.' }
  }
  if (!company_id || !tipo) {
    return { status: 'error', message: 'Empresa y tipo de documento son obligatorios.' }
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const hash = await fileToHash(buffer)

  if (!confirmarDuplicado) {
    const { data: existing } = await supabase
      .from('documents')
      .select('id, nombre_archivo, created_at')
      .eq('company_id', company_id)
      .eq('hash_sha256', hash)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return {
        status: 'duplicate',
        message: `Este archivo parece idéntico a "${existing.nombre_archivo}", subido el ${new Date(
          existing.created_at
        ).toLocaleDateString('es-ES')}. ¿Confirmas que quieres subirlo de todas formas?`,
      }
    }
  }

  const storagePath = `${company_id}/${crypto.randomUUID()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(storagePath, buffer, { contentType: file.type || undefined })

  if (uploadError) {
    return { status: 'error', message: 'No se ha podido subir el archivo. Inténtalo de nuevo.' }
  }

  const { error: insertError } = await supabase.from('documents').insert({
    company_id,
    vehicle_id,
    client_id,
    tipo,
    nombre_archivo: file.name,
    storage_path: storagePath,
    mime_type: file.type || null,
    tamano_bytes: file.size,
    hash_sha256: hash,
    notas,
    created_by: user.id,
  })

  if (insertError) {
    // Limpieza: si falla el registro en BD, no dejamos el archivo huérfano.
    await supabase.storage.from('documentos').remove([storagePath])
    return { status: 'error', message: 'No se ha podido registrar el documento. Inténtalo de nuevo.' }
  }

  revalidatePath('/dashboard/documentos')
  if (vehicle_id) revalidatePath(`/dashboard/vehiculos/${vehicle_id}`)
  if (client_id) revalidatePath(`/dashboard/clientes/${client_id}`)

  return { status: 'success', message: 'Documento subido correctamente.' }
}

export async function getDocumentUrl(storagePath: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('documentos')
    .createSignedUrl(storagePath, 60 * 5) // 5 minutos

  if (error || !data) return null
  return data.signedUrl
}

// Las facturas (venta y rectificativas) tienen numeración correlativa
// obligatoria: no se pueden borrar sin más, solo corregir emitiendo una
// factura rectificativa (ver RectificarFacturaButton). Este chequeo es
// defensa en profundidad — la UI ya no muestra "Eliminar" para ellas.
export async function deleteDocument(documentId: string, storagePath: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: doc } = await supabase.from('documents').select('tipo').eq('id', documentId).single()
  if (doc && TIPOS_FACTURA_PROTEGIDA.includes(doc.tipo as any)) {
    return
  }

  await supabase.storage.from('documentos').remove([storagePath])
  await supabase.from('documents').delete().eq('id', documentId)

  revalidatePath('/dashboard/documentos')
}
