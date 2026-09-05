import { NextRequest, NextResponse } from 'next/server'
import { randomUUID, createHash } from 'crypto'
import { createClient } from '@/lib/supabaseServer'
import { buildFacturaVentaPdf } from '@/lib/facturaVentaPdf'
import { getOrCreateOperationId } from '@/lib/operations'
import { formatNumeroFactura } from '@/lib/invoiceLookup'

// Genera la factura de venta para un vehículo + cliente. Se dispara desde el
// modal de "Generar contrato" al hacer la reserva o la compraventa (con el
// precio que el usuario confirma en ese momento, nunca en silencio el
// precio publicado), no automáticamente a partir de otro dato. Todas las
// facturas son REBU (sin desglose de IVA) — así lo indica el propio PDF.
//
// La numeración correlativa y el registro estructurado de la factura viven
// en public.invoices (no en public.documents) — es el mismo sistema ya
// usado por el trigger que exige factura antes de un contrato de
// compraventa. public.documents solo guarda el PDF.
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
  const clientId: string | null = body?.client_id ?? null
  const precio = Number(body?.precio)

  if (!clientId || !Number.isFinite(precio) || precio <= 0) {
    return NextResponse.json({ error: 'Falta el cliente o el precio no es válido.' }, { status: 400 })
  }

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select(
      'company_id, marca, modelo, matricula, vin, anio, km, company:companies(name, razon_social, cif, direccion, telefono, email)'
    )
    .eq('id', vehicleId)
    .single()

  if (!vehicle) {
    return NextResponse.json({ error: 'Vehículo no encontrado.' }, { status: 404 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select('nombre, dni_nif, direccion, codigo_postal, provincia, telefono, email')
    .eq('id', clientId)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 })
  }

  let operationId: string
  try {
    operationId = await getOrCreateOperationId(supabase, {
      vehicleId,
      clientId,
      companyId: vehicle.company_id,
      userId: user.id,
    })
  } catch {
    return NextResponse.json({ error: 'No se ha podido preparar la operación de este cliente y vehículo.' }, { status: 500 })
  }

  const { data: yaFacturada } = await supabase
    .from('invoices')
    .select('id')
    .eq('operation_id', operationId)
    .eq('tipo', 'venta')
    .maybeSingle()
  if (yaFacturada) {
    return NextResponse.json(
      { error: 'Esta operación ya tiene una factura de venta. Usa "Rectificar" para corregirla.' },
      { status: 409 }
    )
  }

  const companyRow = vehicle.company as any
  const company = {
    razonSocial: companyRow?.razon_social || companyRow?.name || '',
    cif: companyRow?.cif ?? null,
    direccion: companyRow?.direccion ?? null,
    telefono: companyRow?.telefono ?? null,
    email: companyRow?.email ?? null,
  }

  // Numeración correlativa: nº reservado de forma atómica en
  // public.invoice_counters vía public.siguiente_numero_factura (evita que
  // dos facturas generadas casi a la vez salgan con el mismo número).
  const anio = new Date().getFullYear()
  const { data: numero, error: numeroError } = await supabase.rpc('siguiente_numero_factura', {
    p_company_id: vehicle.company_id,
    p_anio: anio,
  })
  if (numeroError || !numero) {
    return NextResponse.json({ error: 'No se ha podido generar el número de factura.' }, { status: 500 })
  }
  const numeroFactura = formatNumeroFactura({ anio, numero, tipo: 'venta' })

  const buffer = await buildFacturaVentaPdf({
    company,
    client,
    vehicle,
    precio,
    numeroFactura,
  })

  const slug = `${vehicle.marca}-${vehicle.modelo}`
    .toString()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '') || 'vehiculo'

  const nombreArchivo = `factura-venta-${slug}.pdf`
  const storagePath = `${vehicle.company_id}/${randomUUID()}-${nombreArchivo}`

  const { error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(storagePath, buffer, { contentType: 'application/pdf' })

  if (!uploadError) {
    const { data: documentRow } = await supabase
      .from('documents')
      .insert({
        company_id: vehicle.company_id,
        vehicle_id: vehicleId,
        client_id: clientId,
        operation_id: operationId,
        tipo: 'factura_venta',
        nombre_archivo: nombreArchivo,
        storage_path: storagePath,
        mime_type: 'application/pdf',
        tamano_bytes: buffer.length,
        hash_sha256: createHash('sha256').update(buffer).digest('hex'),
        created_by: user.id,
      })
      .select('id')
      .single()

    if (documentRow) {
      await supabase.from('invoices').insert({
        company_id: vehicle.company_id,
        operation_id: operationId,
        vehicle_id: vehicleId,
        client_id: clientId,
        numero,
        anio,
        importe: precio,
        tipo: 'venta',
        document_id: documentRow.id,
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
