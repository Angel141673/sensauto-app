import { createClient } from '@/lib/supabaseServer'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import VehicleForm from '@/components/VehicleForm'
import VehicleDocumentsSection from '@/components/VehicleDocumentsSection'
import VehicleGeneralDocuments from '@/components/VehicleGeneralDocuments'
import VehiclePhotoSection from '@/components/VehiclePhotoSection'
import GenerateProformaButton from '@/components/GenerateProformaButton'
import GenerateContractButton from '@/components/GenerateContractButton'
import GenerateFacturaVentaButton from '@/components/GenerateFacturaVentaButton'
import DeleteVehicleButton from '@/components/DeleteVehicleButton'
import { updateVehicle } from '../actions'
import { TIPO_DOCUMENTO_LABEL as FICHA_TECNICA_LABEL } from '@/lib/vehicleDocuments'
import { opcionesEnvioParaTipo, DOCUMENT_TIPO_LABEL } from '@/lib/documents'
import type { SendableDoc } from '@/components/SendDocumentsModal'

const ESTADO_LABEL: Record<string, string> = {
  entrada: 'Entrada / compra',
  preparacion: 'En preparación',
  disponible: 'Disponible',
  reservado: 'Reservado',
  vendido: 'Vendido',
  entregado: 'Entregado',
  posventa: 'Posventa',
}

const ESTADO_LABEL_OPERACION: Record<string, string> = {
  contacto: 'Contacto',
  reserva: 'Reserva',
  compraventa: 'Compraventa',
  entrega: 'Entrega',
  posventa: 'Posventa',
}

function euro(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export default async function VehiculoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ editar?: string }>
}) {
  const { id } = await params
  const { editar } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .select('*, company:companies(id, code, name)')
    .eq('id', id)
    .single()

  if (error || !vehicle) notFound()

  const { data: memberships } = await supabase
    .from('user_companies')
    .select('company:companies(id, code, name)')
    .eq('user_id', user.id)

  const companies = (memberships ?? []).map((m: any) => m.company).filter(Boolean)

  const { data: operations } = await supabase
    .from('operations')
    .select('id, estado, client:clients(id, nombre, telefono, email)')
    .eq('vehicle_id', vehicle.id)
    .order('created_at', { ascending: false })

  const { data: fotoSigned } = vehicle.foto_path
    ? await supabase.storage
        .from('vehicle-photos')
        .createSignedUrl(vehicle.foto_path, 60 * 5)
    : { data: null }

  const { data: allClients } = await supabase
    .from('clients')
    .select('id, nombre')
    .order('nombre', { ascending: true })

  const { data: vehicleDocuments } = await supabase
    .from('vehicle_documents')
    .select('id, tipo_documento, nombre_archivo, storage_path, tamano_bytes, fecha_subida')
    .eq('vehicle_id', vehicle.id)
    .order('fecha_subida', { ascending: false })

  const vehicleDocumentsWithUrls = await Promise.all(
    (vehicleDocuments ?? []).map(async (doc: any) => {
      const { data } = await supabase.storage
        .from('vehicle-documents')
        .createSignedUrl(doc.storage_path, 60 * 5)
      return { ...doc, url: data?.signedUrl ?? null }
    })
  )

  // Cliente al que ofrecer por defecto en el envío de documentación: el de
  // la operación más reciente (mismo criterio que el trigger que vincula
  // automáticamente client_id en vehicle_documents al vender/entregar).
  const clienteEmail = (operations?.[0] as any)?.client?.email ?? null

  const { data: documents } = await supabase
    .from('documents')
    .select('id, tipo, nombre_archivo, storage_path, created_at')
    .eq('vehicle_id', vehicle.id)
    .order('created_at', { ascending: false })

  const documentsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc: any) => {
      const { data } = await supabase.storage
        .from('documentos')
        .createSignedUrl(doc.storage_path, 60 * 5)
      return { ...doc, url: data?.signedUrl ?? null }
    })
  )

  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, proveedor, fecha, total')
    .eq('vehicle_id', vehicle.id)
    .order('fecha', { ascending: false })

  const totalGastos = (expenses ?? []).reduce((acc, e: any) => acc + Number(e.total || 0), 0)

  // Combina ficha técnica (vehicle_documents) + resto de documentación
  // (documents) en una sola lista para "Enviar documentación al cliente".
  const sendableDocs: SendableDoc[] = [
    ...vehicleDocumentsWithUrls.map((d: any) => ({
      id: d.id,
      label: FICHA_TECNICA_LABEL[d.tipo_documento as keyof typeof FICHA_TECNICA_LABEL] ?? d.tipo_documento,
      nombre_archivo: d.nombre_archivo,
      marcadoPorDefecto: true,
    })),
    ...documentsWithUrls.map((d: any) => ({
      id: d.id,
      label: DOCUMENT_TIPO_LABEL[d.tipo as keyof typeof DOCUMENT_TIPO_LABEL] ?? d.tipo,
      nombre_archivo: d.nombre_archivo,
      ...opcionesEnvioParaTipo(d.tipo),
    })),
  ]

  // Inversión total = precio de compra + gastos asociados (Bloque 8 ya
  // implementado: la suma es real, no solo el precio de compra).
  const inversionTotal = (vehicle.precio_compra ?? 0) + totalGastos
  const precioReferencia = vehicle.precio_venta_real ?? vehicle.precio_venta_previsto
  const margen =
    precioReferencia !== null && precioReferencia !== undefined
      ? precioReferencia - inversionTotal
      : null

  const boundUpdate = updateVehicle.bind(null, vehicle.id)

  if (editar) {
    return (
      <div className="vehicles-page">
        <h1>
          Editar {vehicle.marca} {vehicle.modelo}
        </h1>
        <VehicleForm action={boundUpdate} companies={companies} vehicle={vehicle} />
      </div>
    )
  }

  return (
    <div className="vehicles-page">
      <div className="vehicles-header">
        <h1>
          {vehicle.marca} {vehicle.modelo}
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/dashboard/vehiculos/${vehicle.id}?editar=1`} className="primary-btn">
            Editar
          </Link>
          <GenerateProformaButton
            vehicleId={vehicle.id}
            vehiculoLabel={`${vehicle.marca} ${vehicle.modelo}`}
            clients={allClients ?? []}
            precioSugerido={vehicle.precio_venta_previsto}
          />
          <GenerateContractButton
            vehicleId={vehicle.id}
            vehiculoLabel={`${vehicle.marca} ${vehicle.modelo}`}
            clients={allClients ?? []}
            precioSugerido={vehicle.precio_venta_previsto}
          />
          <GenerateFacturaVentaButton
            vehicleId={vehicle.id}
            vehiculoLabel={`${vehicle.marca} ${vehicle.modelo}`}
            clients={allClients ?? []}
            precioSugerido={vehicle.precio_venta_real ?? vehicle.precio_venta_previsto}
          />
          <DeleteVehicleButton vehicleId={vehicle.id} vehiculoLabel={`${vehicle.marca} ${vehicle.modelo}`} />
        </div>
      </div>

      <span className={`estado-badge estado-${vehicle.estado}`}>
        {ESTADO_LABEL[vehicle.estado] ?? vehicle.estado}
      </span>

      <VehiclePhotoSection
        vehicleId={vehicle.id}
        companyId={vehicle.company_id}
        fotoPath={vehicle.foto_path}
        fotoUrl={fotoSigned?.signedUrl ?? null}
      />

      <section className="detail-section">
        <h2>Identificación</h2>
        <dl className="detail-grid">
          <div><dt>Empresa</dt><dd>{vehicle.company?.name}</dd></div>
          <div><dt>Bastidor / VIN</dt><dd>{vehicle.vin || '—'}</dd></div>
          <div><dt>Matrícula</dt><dd>{vehicle.matricula || '—'}</dd></div>
          <div><dt>Número de llave</dt><dd>{vehicle.numero_llave || '—'}</dd></div>
        </dl>
      </section>

      <section className="detail-section">
        <h2>Datos técnicos</h2>
        <dl className="detail-grid">
          <div>
            <dt>Fecha de matriculación</dt>
            <dd>{vehicle.fecha_matriculacion ? new Date(vehicle.fecha_matriculacion).toLocaleDateString('es-ES') : '—'}</dd>
          </div>
          <div><dt>Año</dt><dd>{vehicle.anio ?? '—'}</dd></div>
          <div><dt>Kilómetros</dt><dd>{vehicle.km ?? '—'}</dd></div>
          <div><dt>Motor</dt><dd>{vehicle.motor || '—'}</dd></div>
          <div><dt>Combustible</dt><dd>{vehicle.combustible || '—'}</dd></div>
          <div><dt>Transmisión</dt><dd>{vehicle.transmision || '—'}</dd></div>
          <div><dt>Color</dt><dd>{vehicle.color || '—'}</dd></div>
        </dl>
      </section>

      <section className="detail-section">
        <h2>Económico</h2>
        <dl className="detail-grid">
          <div><dt>Precio de compra</dt><dd>{euro(vehicle.precio_compra)}</dd></div>
          <div><dt>Precio venta previsto</dt><dd>{euro(vehicle.precio_venta_previsto)}</dd></div>
          <div><dt>Precio venta real</dt><dd>{euro(vehicle.precio_venta_real)}</dd></div>
          <div><dt>Gastos asociados</dt><dd>{euro(totalGastos)}</dd></div>
          <div><dt>Inversión total*</dt><dd>{euro(inversionTotal)}</dd></div>
          <div><dt>Margen{vehicle.precio_venta_real ? '' : ' (estimado)'}</dt><dd>{euro(margen)}</dd></div>
        </dl>
        <p className="form-note">
          *Inversión total = precio de compra + gastos asociados registrados en el módulo de gastos.
        </p>
      </section>

      {vehicle.notas && (
        <section className="detail-section">
          <h2>Notas</h2>
          <p>{vehicle.notas}</p>
        </section>
      )}

      <section className="detail-section">
        <h2>Cliente / reserva / venta vinculados</h2>
        {(!operations || operations.length === 0) && (
          <p className="empty-state">Sin clientes vinculados todavía.</p>
        )}
        {operations && operations.length > 0 && (
          <ul className="pending-list">
            {operations.map((op: any) => (
              <li key={op.id}>
                <Link href={`/dashboard/clientes/${op.client.id}`}>{op.client.nombre}</Link>
                {' — '}
                {ESTADO_LABEL_OPERACION[op.estado] ?? op.estado}
                {op.client.telefono ? ` · ${op.client.telefono}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <VehicleDocumentsSection
        vehicleId={vehicle.id}
        companyId={vehicle.company_id}
        companyCode={vehicle.company?.code ?? ''}
        documentos={vehicleDocumentsWithUrls}
      />

      <VehicleGeneralDocuments
        vehicleId={vehicle.id}
        companyId={vehicle.company_id}
        vehiculoLabel={`${vehicle.marca} ${vehicle.modelo}`}
        estado={vehicle.estado}
        documentos={documentsWithUrls}
        sendableDocs={sendableDocs}
        clienteEmail={clienteEmail}
      />

      <section className="detail-section">
        <h2>Gastos asociados</h2>
        {(!expenses || expenses.length === 0) && (
          <p className="empty-state">Sin gastos registrados todavía.</p>
        )}
        {expenses && expenses.length > 0 && (
          <ul className="pending-list">
            {expenses.map((e: any) => (
              <li key={e.id}>
                {e.proveedor || 'Proveedor sin especificar'}
                {' — '}
                {Number(e.total).toFixed(2)} €
                {e.fecha ? ` (${new Date(e.fecha).toLocaleDateString('es-ES')})` : ''}
              </li>
            ))}
          </ul>
        )}
        <Link href={`/dashboard/gastos?empresa=${vehicle.company.code}`} className="secondary-btn" style={{ display: 'inline-block', marginTop: 10 }}>
          Ir a gastos
        </Link>
      </section>

      <section className="detail-section">
        <h2>Contratos y firma</h2>
        <p className="form-note">
          La firma de contratos (reserva/compraventa) se gestiona desde la
          ficha del cliente vinculado a este vehículo, en cada operación.
        </p>
      </section>
    </div>
  )
}
