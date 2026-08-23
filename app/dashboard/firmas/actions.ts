'use server'

import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

export async function saveSignature(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const company_id = String(formData.get('company_id') ?? '')
  const operation_id = String(formData.get('operation_id') ?? '')
  const client_id = String(formData.get('client_id') ?? '')
  const tipo_contrato = String(formData.get('tipo_contrato') ?? '')
  const texto_aceptacion = String(formData.get('texto_aceptacion') ?? '')
  const contract_document_id = (formData.get('contract_document_id') as string) || null
  const signatureFile = formData.get('signature') as File | null

  if (!company_id || !operation_id || !client_id || !tipo_contrato || !signatureFile) {
    throw new Error('Faltan datos para guardar la firma.')
  }

  const buffer = Buffer.from(await signatureFile.arrayBuffer())
  const storagePath = `${company_id}/${randomUUID()}-firma.png`

  const { error: uploadError } = await supabase.storage
    .from('firmas')
    .upload(storagePath, buffer, { contentType: 'image/png' })

  if (uploadError) {
    throw new Error('No se ha podido guardar la firma. Inténtalo de nuevo.')
  }

  const { error: insertError } = await supabase.from('signatures').insert({
    company_id,
    operation_id,
    client_id,
    tipo_contrato,
    contract_document_id,
    storage_path: storagePath,
    texto_aceptacion,
    created_by: user.id,
  })

  if (insertError) {
    await supabase.storage.from('firmas').remove([storagePath])
    throw new Error('No se ha podido registrar la firma. Inténtalo de nuevo.')
  }

  revalidatePath(`/dashboard/clientes/${client_id}`)
  redirect(`/dashboard/clientes/${client_id}`)
}
