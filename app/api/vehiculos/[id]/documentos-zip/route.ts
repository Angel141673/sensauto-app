import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { buildDocumentsZip } from '@/app/dashboard/vehiculos/[id]/documentos/actions'

// Genera y descarga un ZIP con los documentos seleccionados de un vehículo.
// POST { document_ids: string[] } — devuelve el .zip como adjunto descargable.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: vehicleId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const documentIds: string[] = Array.isArray(body?.document_ids) ? body.document_ids : []

  if (documentIds.length === 0) {
    return NextResponse.json({ error: 'No hay documentos seleccionados.' }, { status: 400 })
  }

  const result = await buildDocumentsZip(vehicleId, documentIds)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${result.nombreZip}"`,
      'Content-Length': String(result.buffer.length),
    },
  })
}
