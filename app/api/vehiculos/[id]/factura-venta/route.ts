import { NextRequest, NextResponse } from 'next/server'
import { randomUUID, createHash } from 'crypto'
import { createClient } from '@/lib/supabaseServer'
import { buildFacturaVentaPdf } from '@/lib/facturaVentaPdf'

// Genera la factura de venta para un vehículo + cliente. Se dispara desde el
// modal de "Generar contrato" al hacer la reserva (con el precio que el
// usuario confirma en ese momento, nunca en silencio el precio publicado),
// no automáticamente a partir de otro dato. Todas las facturas son REBU
// (sin desglose de IVA) — así lo indica el propio PDF.
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

  const companyRow = vehicle.company as any
  const company = {
    razonSocial: companyRow?.razon_social || companyRow?.name || '',
    cif: companyRow?.cif ?? null,
    direccion: companyRow?.direccion ?? null,
    telefono: companyRow?.telefono ?? null,
    email: companyRow?.email ?? null,
  }

  // Numeración correlativa sencilla: año + nº de facturas de venta ya
  // emitidas por esta empresa en el año en curso.
  const yearStart = `${new Date().getFullYear()}-01-01`
  const { count } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', vehicle.company_id)
    .eq('tipo', 'factura_venta')
    .gte('created_at', yearStart)
  const numeroFactura = `${new Date().getFullYear()}/${String((count ?? 0) + 1).padStart(4, '0')}`

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
    await supabase.from('documents').insert({
      company_id: vehicle.company_id,
      vehicle_id: vehicleId,
      client_id: clientId,
      tipo: 'factura_venta',
      nombre_archivo: nombreArchivo,
      storage_path: storagePath,
      mime_type: 'application/pdf',
      tamano_bytes: buffer.length,
      hash_sha256: createHash('sha256').update(buffer).digest('hex'),
      created_by: user.id,
    })
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
