import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'
import { buildDniPdf } from '@/lib/dniPdf'

// Genera un PDF con el anverso y el reverso del DNI del cliente colocados
// a tamaño real (85,6 × 54 mm), listo para imprimir y enviar a Tráfico.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { data: client } = await supabase.from('clients').select('nombre').eq('id', clientId).single()
  if (!client) {
    return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 })
  }

  const { data: docs } = await supabase
    .from('documents')
    .select('tipo, storage_path, mime_type')
    .eq('client_id', clientId)
    .in('tipo', ['dni_anverso', 'dni_reverso'])

  const anverso = docs?.find((d) => d.tipo === 'dni_anverso')
  const reverso = docs?.find((d) => d.tipo === 'dni_reverso')

  if (!anverso || !reverso) {
    return NextResponse.json({ error: 'Faltan fotos del DNI (anverso y reverso).' }, { status: 400 })
  }

  const [anversoFile, reversoFile] = await Promise.all([
    supabase.storage.from('documentos').download(anverso.storage_path),
    supabase.storage.from('documentos').download(reverso.storage_path),
  ])

  if (!anversoFile.data || !reversoFile.data) {
    return NextResponse.json({ error: 'No se han podido leer las fotos del DNI.' }, { status: 500 })
  }

  const buffer = await buildDniPdf({
    clienteNombre: client.nombre,
    anversoBytes: Buffer.from(await anversoFile.data.arrayBuffer()),
    anversoMime: anverso.mime_type,
    reversoBytes: Buffer.from(await reversoFile.data.arrayBuffer()),
    reversoMime: reverso.mime_type,
  })

  const slug =
    client.nombre
      .toString()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '') || 'cliente'

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dni-${slug}.pdf"`,
      'Content-Length': String(buffer.length),
    },
  })
}
