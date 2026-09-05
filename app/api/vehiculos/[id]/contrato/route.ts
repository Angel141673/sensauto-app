import { NextRequest, NextResponse } from 'next/server'
import { randomUUID, createHash } from 'crypto'
import { createClient } from '@/lib/supabaseServer'
import { buildCompraventaPdf, buildReservaPdf } from '@/lib/contractPdf'
import { getOrCreateOperationId } from '@/lib/operations'

// Genera el contrato de reserva o de compraventa para un vehículo + cliente,
// con los datos fiscales de la empresa dueña del vehículo (SENSAUTO o
// SUNAUTO) rellenados automáticamente. POST { client_id, tipo_contrato,
// ...condiciones económicas } — devuelve el .pdf como adjunto y lo guarda
// también en Documentos (igual que el presupuesto).
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
  const tipoContrato: 'reserva' | 'compraventa' = body?.tipo_contrato === 'reserva' ? 'reserva' : 'compraventa'

  if (!clientId) {
    return NextResponse.json({ error: 'Falta el cliente.' }, { status: 400 })
  }

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select(
      'company_id, marca, modelo, matricula, vin, fecha_matriculacion, km, combustible, transmision, motor, color, company:companies(name, razon_social, cif, direccion, telefono, email, datos_bancarios)'
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
    datosBancarios: companyRow?.datos_bancarios ?? null,
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

  // El contrato de compraventa exige que la operación ya tenga factura de
  // venta (lo blinda también un trigger en base de datos) — se comprueba
  // aquí para devolver un error legible en vez de una excepción de SQL. El
  // precio del contrato se toma de esa factura, nunca de lo que mande el
  // cliente: así reserva, factura y compraventa muestran siempre la misma
  // cifra, sin depender de que nadie la retecleé igual en cada paso.
  let precioFacturaCompraventa: number | null = null
  if (tipoContrato === 'compraventa') {
    const { data: facturaExistente } = await supabase
      .from('invoices')
      .select('importe')
      .eq('operation_id', operationId)
      .maybeSingle()
    if (!facturaExistente) {
      return NextResponse.json(
        { error: 'Genera primero la factura de venta de esta operación.' },
        { status: 409 }
      )
    }
    precioFacturaCompraventa = facturaExistente.importe
  }

  let buffer: Buffer
  let tipoDocumento: 'contrato_compraventa' | 'contrato_reserva'
  let precioParaVehiculo: number | null = null
  let precioReserva: number | null = null

  if (tipoContrato === 'reserva') {
    const precioTotal = Number(body?.precio_total)
    const senal = Number(body?.senal)
    if (!Number.isFinite(precioTotal) || precioTotal <= 0 || !Number.isFinite(senal) || senal < 0) {
      return NextResponse.json({ error: 'El precio total y la señal no son válidos.' }, { status: 400 })
    }
    precioReserva = precioTotal
    buffer = await buildReservaPdf({
      company,
      client,
      vehicle,
      economicos: {
        precioTotal,
        senal,
        fechaLimite: (body?.fecha_limite as string) || null,
        plazoDias: Number.isFinite(Number(body?.plazo_dias)) && Number(body?.plazo_dias) > 0 ? Number(body.plazo_dias) : 15,
        condicionadaFinanciacion: Boolean(body?.condicionada_financiacion),
        observaciones: (body?.observaciones as string) || null,
      },
    })
    tipoDocumento = 'contrato_reserva'
  } else {
    const precio = precioFacturaCompraventa as number
    precioParaVehiculo = precio
    const entregaACuenta = body?.entrega_a_cuenta ? Number(body.entrega_a_cuenta) : null
    buffer = await buildCompraventaPdf({
      company,
      client,
      vehicle,
      economicos: {
        precio,
        entregaACuenta: entregaACuenta && Number.isFinite(entregaACuenta) ? entregaACuenta : null,
        formaPago: (body?.forma_pago as string) || null,
        fechaEntrega: (body?.fecha_entrega as string) || null,
        garantiaAmpliada: Boolean(body?.garantia_ampliada),
        garantiaImporte: body?.garantia_importe ? Number(body.garantia_importe) : null,
        elementos: {
          llaves: body?.elementos?.llaves !== false,
          chaleco: body?.elementos?.chaleco !== false,
          kit: body?.elementos?.kit !== false,
          documentacion: body?.elementos?.documentacion !== false,
        },
        observaciones: (body?.observaciones as string) || null,
      },
    })
    tipoDocumento = 'contrato_compraventa'
  }

  const slug = `${vehicle.marca}-${vehicle.modelo}`
    .toString()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '') || 'vehiculo'

  const nombreArchivo = `contrato-${tipoContrato}-${slug}.pdf`

  const storagePath = `${vehicle.company_id}/${randomUUID()}-${nombreArchivo}`
  const { error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(storagePath, buffer, { contentType: 'application/pdf' })

  if (!uploadError) {
    await supabase.from('documents').insert({
      company_id: vehicle.company_id,
      vehicle_id: vehicleId,
      client_id: clientId,
      operation_id: operationId,
      tipo: tipoDocumento,
      nombre_archivo: nombreArchivo,
      storage_path: storagePath,
      mime_type: 'application/pdf',
      tamano_bytes: buffer.length,
      hash_sha256: createHash('sha256').update(buffer).digest('hex'),
      created_by: user.id,
    })
  }

  // Generar el contrato también mueve el vehículo por su ciclo de vida:
  // avanza el estado de la operación y, en compraventa, marca el vehículo
  // como vendido. Nunca retrocede un estado ya más avanzado (p. ej. no
  // reabre un "vendido" a "reservado"). A propósito no bloquea la
  // descarga del PDF si algo aquí falla.
  try {
    const OPERATION_ORDER = ['contacto', 'reserva', 'compraventa', 'entrega', 'posventa']
    const targetOperationEstado = tipoContrato === 'reserva' ? 'reserva' : 'compraventa'

    const { data: existingOp } = await supabase
      .from('operations')
      .select('estado')
      .eq('id', operationId)
      .single()

    if (existingOp && OPERATION_ORDER.indexOf(targetOperationEstado) > OPERATION_ORDER.indexOf(existingOp.estado)) {
      await supabase.from('operations').update({ estado: targetOperationEstado }).eq('id', operationId)
    }

    const VEHICLE_ORDER = ['entrada', 'preparacion', 'disponible', 'reservado', 'vendido', 'entregado', 'posventa']
    const { data: vehicleEstadoRow } = await supabase.from('vehicles').select('estado').eq('id', vehicleId).single()
    const currentVehicleEstado = vehicleEstadoRow?.estado ?? 'entrada'

    if (tipoContrato === 'compraventa' && precioParaVehiculo !== null) {
      if (VEHICLE_ORDER.indexOf('vendido') > VEHICLE_ORDER.indexOf(currentVehicleEstado)) {
        await supabase
          .from('vehicles')
          .update({
            estado: 'vendido',
            precio_venta_real: precioParaVehiculo,
            fecha_venta: new Date().toISOString().slice(0, 10),
          })
          .eq('id', vehicleId)
      }
    } else if (tipoContrato === 'reserva' && precioReserva !== null) {
      // El precio pactado en la reserva pasa a ser el precio de referencia
      // del vehículo — así la factura de venta (siguiente paso) sugiere
      // por defecto esta misma cifra en vez de la prevista originalmente.
      const vehicleUpdate: Record<string, unknown> = { precio_venta_previsto: precioReserva }
      if (VEHICLE_ORDER.indexOf('reservado') > VEHICLE_ORDER.indexOf(currentVehicleEstado)) {
        vehicleUpdate.estado = 'reservado'
      }
      await supabase.from('vehicles').update(vehicleUpdate).eq('id', vehicleId)
    }
  } catch {
    // No bloquea la descarga del PDF — el documento ya se generó y guardó.
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
