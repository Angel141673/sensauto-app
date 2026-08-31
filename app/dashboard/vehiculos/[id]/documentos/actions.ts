'use server'

import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
// archiver@8 reescribió su API pública: ya no exporta una función factory
// (`archiver('zip', ...)`), ahora exporta la clase `ZipArchive` que se
// instancia con `new`. Se carga con require porque el import por defecto
// de ES modules no lo resuelve bien en el bundle de servidor de Next.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ZipArchive } = require('archiver') as typeof import('archiver')
import { Resend } from 'resend'
import { TIPO_DOCUMENTO_LABEL, type VehicleDocumentTipo } from '@/lib/vehicleDocuments'

export type UploadDocState = {
  status: 'idle' | 'success' | 'error'
  message?: string
}

export async function uploadVehicleDocument(
  vehicleId: string,
  companyId: string,
  prevState: UploadDocState,
  formData: FormData
): Promise<UploadDocState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tipo_documento = String(formData.get('tipo_documento') ?? '') as VehicleDocumentTipo
  const file = formData.get('file') as File | null

  if (!tipo_documento || !file || file.size === 0) {
    return { status: 'error', message: 'Selecciona el tipo de documento y un archivo.' }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${companyId}/${vehicleId}/${randomUUID()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('vehicle-documents')
    .upload(storagePath, buffer, { contentType: file.type || undefined })

  if (uploadError) {
    return { status: 'error', message: 'No se ha podido subir el archivo. Inténtalo de nuevo.' }
  }

  const { error: insertError } = await supabase.from('vehicle_documents').insert({
    vehicle_id: vehicleId,
    company_id: companyId,
    tipo_documento,
    nombre_archivo: file.name,
    storage_path: storagePath,
    tamano_bytes: file.size,
    subido_por: user.id,
  })

  if (insertError) {
    await supabase.storage.from('vehicle-documents').remove([storagePath])
    return { status: 'error', message: 'No se ha podido registrar el documento. Inténtalo de nuevo.' }
  }

  revalidatePath(`/dashboard/vehiculos/${vehicleId}`)
  return { status: 'success', message: 'Documento subido correctamente.' }
}

export async function deleteVehicleDocument(
  documentId: string,
  storagePath: string,
  vehicleId: string
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.storage.from('vehicle-documents').remove([storagePath])
  await supabase.from('vehicle_documents').delete().eq('id', documentId)

  revalidatePath(`/dashboard/vehiculos/${vehicleId}`)
}

// Genera el ZIP en memoria a partir de los documentos seleccionados.
// Compartido por la descarga directa (route handler) y el envío por email.
export async function buildDocumentsZip(
  vehicleId: string,
  documentIds: string[]
): Promise<{ buffer: Buffer; nombreZip: string } | { error: string }> {
  const supabase = await createClient()

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('matricula, marca, modelo')
    .eq('id', vehicleId)
    .single()

  if (!vehicle) return { error: 'Vehículo no encontrado.' }

  const { data: documents } = await supabase
    .from('vehicle_documents')
    .select('id, nombre_archivo, storage_path')
    .eq('vehicle_id', vehicleId)
    .in('id', documentIds)

  if (!documents || documents.length === 0) {
    return { error: 'No hay documentos seleccionados para descargar.' }
  }

  const archive = new ZipArchive({ zlib: { level: 9 } })
  const chunks: Buffer[] = []
  archive.on('data', (chunk: Buffer) => chunks.push(chunk))

  const donePromise = new Promise<void>((resolve, reject) => {
    archive.on('end', () => resolve())
    archive.on('error', (err: Error) => reject(err))
  })

  for (const doc of documents) {
    const { data, error } = await supabase.storage.from('vehicle-documents').download(doc.storage_path)
    if (error || !data) continue
    const buf = Buffer.from(await data.arrayBuffer())
    archive.append(buf, { name: doc.nombre_archivo })
  }

  archive.finalize()
  await donePromise

  const slug = (vehicle.matricula || `${vehicle.marca}-${vehicle.modelo}`)
    .toString()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '') || 'vehiculo'

  return { buffer: Buffer.concat(chunks), nombreZip: `${slug}-documentacion.zip` }
}

export type SendDocumentsState = {
  status: 'idle' | 'success' | 'error'
  message?: string
}

const ZIP_ADJUNTO_MAX_BYTES = 20 * 1024 * 1024 // 20 MB: por encima, se envía como link de descarga

export async function sendVehicleDocumentsEmail(
  vehicleId: string,
  prevState: SendDocumentsState,
  formData: FormData
): Promise<SendDocumentsState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const email = String(formData.get('email') ?? '').trim()
  const asunto = String(formData.get('asunto') ?? '').trim()
  const documentIds = formData.getAll('document_ids').map(String)

  if (!email || !asunto || documentIds.length === 0) {
    return { status: 'error', message: 'Falta el email, el asunto o no hay documentos seleccionados.' }
  }

  if (!process.env.RESEND_API_KEY) {
    return {
      status: 'error',
      message: 'RESEND_API_KEY no está configurada. Añádela a las variables de entorno para poder enviar emails.',
    }
  }

  const zipResult = await buildDocumentsZip(vehicleId, documentIds)
  if ('error' in zipResult) {
    return { status: 'error', message: zipResult.error }
  }

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('marca, modelo, matricula')
    .eq('id', vehicleId)
    .single()

  const { data: selectedDocs } = await supabase
    .from('vehicle_documents')
    .select('tipo_documento')
    .eq('vehicle_id', vehicleId)
    .in('id', documentIds)

  const listaHtml = (selectedDocs ?? [])
    .map((d: any) => `<li>${TIPO_DOCUMENTO_LABEL[d.tipo_documento as VehicleDocumentTipo] ?? d.tipo_documento}</li>`)
    .join('')

  const vehiculoLabel = vehicle ? `${vehicle.marca} ${vehicle.modelo}${vehicle.matricula ? ` (${vehicle.matricula})` : ''}` : ''

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    if (zipResult.buffer.length <= ZIP_ADJUNTO_MAX_BYTES) {
      const { error } = await resend.emails.send({
        from: 'SENSAUTO <onboarding@resend.dev>',
        to: email,
        subject: asunto,
        html: `<p>Adjuntamos la documentación de tu vehículo ${vehiculoLabel}:</p><ul>${listaHtml}</ul>`,
        attachments: [{ filename: zipResult.nombreZip, content: zipResult.buffer }],
      })
      if (error) {
        return { status: 'error', message: 'No se ha podido enviar el email. Inténtalo de nuevo.' }
      }
    } else {
      // Demasiado pesado para ir de adjunto: se sube el ZIP y se envía un
      // enlace de descarga temporal en su lugar.
      const tempPath = `_temp-zips/${randomUUID()}-${zipResult.nombreZip}`
      const { error: uploadError } = await supabase.storage
        .from('vehicle-documents')
        .upload(tempPath, zipResult.buffer, { contentType: 'application/zip' })

      if (uploadError) {
        return { status: 'error', message: 'No se ha podido preparar el archivo para el envío.' }
      }

      const { data: signed } = await supabase.storage
        .from('vehicle-documents')
        .createSignedUrl(tempPath, 60 * 60 * 24 * 7) // 7 días

      const { error } = await resend.emails.send({
        from: 'SENSAUTO <onboarding@resend.dev>',
        to: email,
        subject: asunto,
        html: `<p>Adjuntamos el enlace de descarga de la documentación de tu vehículo ${vehiculoLabel} (el archivo es demasiado grande para ir adjunto directamente, el enlace caduca en 7 días):</p><p><a href="${signed?.signedUrl}">Descargar documentación</a></p><ul>${listaHtml}</ul>`,
      })
      if (error) {
        return { status: 'error', message: 'No se ha podido enviar el email. Inténtalo de nuevo.' }
      }
    }
  } catch {
    return { status: 'error', message: 'No se ha podido enviar el email. Inténtalo de nuevo.' }
  }

  return { status: 'success', message: `Documentación enviada a ${email}.` }
}
