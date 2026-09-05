import { NextRequest, NextResponse } from 'next/server'
import { randomUUID, createHash } from 'crypto'
import { createClient } from '@/lib/supabaseServer'
import { buildFacturaRectificativaPdf } from '@/lib/facturaRectificativaPdf'
import { formatNumeroFactura } from '@/lib/invoiceLookup'

// Genera una factura rectificativa que referencia a una factura de venta
// (o a otra rectificativa) ya emitida. La original nunca se borra ni se
// modifica — así se conserva la correlatividad exigida por Hacienda. El
// id de la URL es el id del documento (public.documents) del PDF original
// — se busca su registro estructurado en public.invoices a partir de ahí.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const precioNuevo = Number(body?.precio_nuevo)
  const motivo = String(body?.motivo ?? '').trim()

  if (!Number.isFinite(precioNuevo) || precioNuevo < 0) {
    return NextResponse.json({ error: 'Introduce el importe correcto.' }, { status: 400 })
  }
  if (!motivo) {
    return NextResponse.json({ error: 'Indica el motivo de la rectificación.' }, { status: 400 })
  }

  const { data: original } = await supabase
    .from('invoices')
    .select('id, company_id, operation_id, vehicle_id, client_id, numero, anio, importe, tipo, fecha')
    .eq('document_id', documentId)
    .single()

  if (!original) {
    return NextResponse.json({ error: 'La factura original no existe o no se puede rectificar.' }, { status: 404 })
  }
  if (!original.vehicle_id || !original.client_id) {
    return NextResponse.json({ error: 'La factura original no tiene vehículo o cliente asociado.' }, { status: 400 })
  }

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select(
      'marca, modelo, matricula, vin, anio, km, company:companies(name, razon_social, cif, direccion, telefono, email)'
    )
    .eq('id', original.vehicle_id)
    .single()

  if (!vehicle) {
    return NextResponse.json({ error: 'Vehículo no encontrado.' }, { status: 404 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select('nombre, dni_nif, direccion, codigo_postal, provincia, telefono, email')
    .eq('id', original.client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 })
  }

  const companyRow = vehicle.company as any
  const company = {
    razonSocial: companyRow?.razon_social || companyRow?.name || '',
    cif: companyRow?.cif ?? null,
    direccion: companyRow?.direccion ?? null,
    telefono: companyRow?.telefono ?? null,
    email: companyRow?.email ?? null,
  }

  const anio = new Date().getFullYear()
  const { data: numero, error: numeroError } = await supabase.rpc('siguiente_numero_factura', {
    p_company_id: original.company_id,
    p_anio: anio,
  })
  if (numeroError || !numero) {
    return NextResponse.json({ error: 'No se ha podido generar el número de la rectificativa.' }, { status: 500 })
  }
  const numeroFactura = formatNumeroFactura({ anio, numero, tipo: 'rectificativa' })
  const numeroOriginal = formatNumeroFactura({ anio: original.anio, numero: original.numero, tipo: original.tipo })

  const buffer = await buildFacturaRectificativaPdf({
    company,
    client,
    vehicle,
    precioOriginal: original.importe,
    precioNuevo,
    motivo,
    numeroFactura,
    numeroOriginal,
    fechaOriginal: original.fecha,
  })

  const slug = `${vehicle.marca}-${vehicle.modelo}`
    .toString()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '') || 'vehiculo'

  const nombreArchivo = `factura-rectificativa-${slug}.pdf`
  const storagePath = `${original.company_id}/${randomUUID()}-${nombreArchivo}`

  const { error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(storagePath, buffer, { contentType: 'application/pdf' })

  if (!uploadError) {
    const { data: newDocument } = await supabase
      .from('documents')
      .insert({
        company_id: original.company_id,
        vehicle_id: original.vehicle_id,
        client_id: original.client_id,
        operation_id: original.operation_id,
        tipo: 'factura_rectificativa',
        nombre_archivo: nombreArchivo,
        storage_path: storagePath,
        mime_type: 'application/pdf',
        tamano_bytes: buffer.length,
        hash_sha256: createHash('sha256').update(buffer).digest('hex'),
        created_by: user.id,
      })
      .select('id')
      .single()

    if (newDocument) {
      await supabase.from('invoices').insert({
        company_id: original.company_id,
        operation_id: original.operation_id,
        vehicle_id: original.vehicle_id,
        client_id: original.client_id,
        numero,
        anio,
        importe: precioNuevo,
        tipo: 'rectificativa',
        rectifica_invoice_id: original.id,
        document_id: newDocument.id,
        created_by: user.id,
      })
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
