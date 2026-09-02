import { NextRequest, NextResponse } from 'next/server'
import { randomUUID, createHash } from 'crypto'
import { createClient } from '@/lib/supabaseServer'
import { buildProformaPdf } from '@/lib/proformaPdf'

// Genera el PDF de presupuesto/factura proforma para un vehículo + cliente.
// POST { client_id: string, precio: number } — devuelve el .pdf como adjunto.
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
    .select('company_id, marca, modelo, matricula, vin, anio, km, motor, color, combustible, transmision, company:companies(name, cif, direccion, telefono, email)')
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

  const company = vehicle.company as any

  const buffer = await buildProformaPdf({
    company: {
      name: company?.name ?? '',
      cif: company?.cif ?? null,
      direccion: company?.direccion ?? null,
      telefono: company?.telefono ?? null,
      email: company?.email ?? null,
    },
    client,
    vehicle,
    precio,
  })

  const slug = `${vehicle.marca}-${vehicle.modelo}`
    .toString()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '') || 'vehiculo'

  const nombreArchivo = `presupuesto-${slug}.pdf`

  // Se guarda también como documento (histórico/descarga posterior desde
  // Documentos) — si falla el guardado no se bloquea la descarga en curso.
  const storagePath = `${vehicle.company_id}/${randomUUID()}-${nombreArchivo}`
  const { error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(storagePath, buffer, { contentType: 'application/pdf' })

  if (!uploadError) {
    await supabase.from('documents').insert({
      company_id: vehicle.company_id,
      vehicle_id: vehicleId,
      client_id: clientId,
      tipo: 'presupuesto',
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
      'Content-Disposition': `attachment; filename="presupuesto-${slug}.pdf"`,
      'Content-Length': String(buffer.length),
    },
  })
}
