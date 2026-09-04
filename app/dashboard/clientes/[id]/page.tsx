import { createClient } from '@/lib/supabaseServer'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ClientForm from '@/components/ClientForm'
import WhatsAppButton from '@/components/WhatsAppButton'
import ClientVehicleDocumentsSection from '@/components/ClientVehicleDocumentsSection'
import ClientDniSection from '@/components/ClientDniSection'
import GenerateContractButton from '@/components/GenerateContractButton'
import DeleteClientButton from '@/components/DeleteClientButton'
import { updateClientRecord, linkVehicleToClient, updateOperationEstado } from '../actions'
import UnlinkVehicleButton from '@/components/UnlinkVehicleButton'
import { TIPO_DOCUMENTO_LABEL as FICHA_TECNICA_LABEL } from '@/lib/vehicleDocuments'
import { opcionesEnvioParaTipo, DOCUMENT_TIPO_LABEL } from '@/lib/documents'
import { withDownload } from '@/lib/downloadUrl'

const ESTADO_OPERACION_LABEL: Record<string, string> = {
  contacto: 'Contacto',
  reserva: 'Reserva',
  compraventa: 'Compraventa',
  entrega: 'Entrega',
  posventa: 'Posventa',
}

const ESTADOS_OPERACION = ['contacto', 'reserva', 'compraventa', 'entrega', 'posventa']

export default async function ClienteDetallePage({
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

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !client) notFound()

  const { data: operations } = await supabase
    .from('operations')
    .select(
      'id, estado, created_at, vehicle:vehicles(id, marca, modelo, vin, estado, precio_venta_previsto, company:companies(code))'
    )
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  // Vehículos de cualquiera de las dos empresas que aún no están vinculados
  // a este cliente — un mismo cliente puede tener operaciones en ambas.
  const linkedVehicleIds = (operations ?? []).map((o: any) => o.vehicle?.id).filter(Boolean)
  const { data: availableVehiclesRaw } = await supabase
    .from('vehicles')
    .select('id, marca, modelo, vin, company:companies(code)')
    .order('created_at', { ascending: false })

  const availableVehicles = (availableVehiclesRaw ?? []).filter(
    (v: any) => !linkedVehicleIds.includes(v.id)
  )

  const { data: documents } = await supabase
    .from('documents')
    .select('id, tipo, nombre_archivo, storage_path, created_at')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  const documentsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc: any) => {
      const { data } = await supabase.storage
        .from('documentos')
        .createSignedUrl(doc.storage_path, 60 * 5)
      return { ...doc, url: data?.signedUrl ?? null }
    })
  )

  const dniDocs = documentsWithUrls.filter((d: any) => d.tipo === 'dni')
  const otherDocs = documentsWithUrls.filter((d: any) => d.tipo !== 'dni')

  const { data: memberships } = await supabase
    .from('user_companies')
    .select('company:companies(id, code, name)')
    .eq('user_id', user.id)
  const companies = (memberships ?? []).map((m: any) => m.company).filter(Boolean)
  const primerVehiculoCompanyCode = (operations?.[0] as any)?.vehicle?.company?.code
  const defaultCompanyId =
    companies.find((c: any) => c.code === primerVehiculoCompanyCode)?.id ?? companies[0]?.id ?? ''

  const { data: signatures } = await supabase
    .from('signatures')
    .select('id, tipo_contrato, fecha_firma, storage_path')
    .eq('client_id', client.id)
    .order('fecha_firma', { ascending: false })

  const signaturesWithUrls = await Promise.all(
    (signatures ?? []).map(async (s: any) => {
      const { data } = await supabase.storage.from('firmas').createSignedUrl(s.storage_path, 60 * 5, { download: true })
      return { ...s, url: data?.signedUrl ?? null }
    })
  )

  const vehicleIds = linkedVehicleIds as string[]
  const { data: allVehicleDocuments } = vehicleIds.length
    ? await supabase
        .from('vehicle_documents')
        .select('id, vehicle_id, tipo_documento, nombre_archivo, storage_path, tamano_bytes')
        .in('vehicle_id', vehicleIds)
        .order('fecha_subida', { ascending: false })
    : { data: [] }

  const vehicleDocumentsWithUrls = await Promise.all(
    (allVehicleDocuments ?? []).map(async (doc: any) => {
      const { data } = await supabase.storage
        .from('vehicle-documents')
        .createSignedUrl(doc.storage_path, 60 * 5)
      return { ...doc, url: data?.signedUrl ?? null }
    })
  )

  // Resto de documentación de esos mismos vehículos (contratos, facturas...)
  // — misma tabla que usa la pestaña general "Documentos".
  const { data: allVehicleOtherDocs } = vehicleIds.length
    ? await supabase
        .from('documents')
        .select('id, vehicle_id, tipo, nombre_archivo, storage_path')
        .in('vehicle_id', vehicleIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const vehicleOtherDocsWithUrls = await Promise.all(
    (allVehicleOtherDocs ?? []).map(async (doc: any) => {
      const { data } = await supabase.storage
        .from('documentos')
        .createSignedUrl(doc.storage_path, 60 * 5)
      return { ...doc, url: data?.signedUrl ?? null }
    })
  )

  const vehiculosConDocs = (operations ?? []).map((op: any) => ({
    vehicleId: op.vehicle.id,
    vehiculoLabel: `${op.vehicle.marca} ${op.vehicle.modelo}`,
    documentos: [
      ...vehicleDocumentsWithUrls
        .filter((d: any) => d.vehicle_id === op.vehicle.id)
        .map((d: any) => ({
          id: d.id,
          label: FICHA_TECNICA_LABEL[d.tipo_documento as keyof typeof FICHA_TECNICA_LABEL] ?? d.tipo_documento,
          nombre_archivo: d.nombre_archivo,
          url: d.url,
          marcadoPorDefecto: true,
        })),
      ...vehicleOtherDocsWithUrls
        .filter((d: any) => d.vehicle_id === op.vehicle.id)
        .map((d: any) => ({
          id: d.id,
          label: DOCUMENT_TIPO_LABEL[d.tipo as keyof typeof DOCUMENT_TIPO_LABEL] ?? d.tipo,
          nombre_archivo: d.nombre_archivo,
          url: d.url,
          ...opcionesEnvioParaTipo(d.tipo),
        })),
    ],
  }))

  const boundUpdate = updateClientRecord.bind(null, client.id)
  const boundLink = linkVehicleToClient.bind(null, client.id)

  if (editar) {
    return (
      <div className="vehicles-page">
        <h1>Editar {client.nombre}</h1>
        <ClientForm action={boundUpdate} client={client} />
      </div>
    )
  }

  return (
    <div className="vehicles-page">
      <div className="vehicles-header">
        <h1>{client.nombre}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/dashboard/clientes/${client.id}?editar=1`} className="primary-btn">
            Editar
          </Link>
          <DeleteClientButton clientId={client.id} clientNombre={client.nombre} />
        </div>
      </div>

      <section className="detail-section">
        <h2>Datos</h2>
        <dl className="detail-grid">
          <div><dt>Teléfono</dt><dd>{client.telefono || '—'}</dd></div>
          <div><dt>Email</dt><dd>{client.email || '—'}</dd></div>
          <div><dt>DNI / NIF</dt><dd>{client.dni_nif || '—'}</dd></div>
          <div><dt>Calle</dt><dd>{client.direccion || '—'}</dd></div>
          <div><dt>Código postal</dt><dd>{client.codigo_postal || '—'}</dd></div>
          <div><dt>Provincia</dt><dd>{client.provincia || '—'}</dd></div>
        </dl>
      </section>

      <ClientDniSection
        clientId={client.id}
        companies={companies}
        defaultCompanyId={defaultCompanyId}
        documentos={dniDocs}
      />

      {client.notas && (
        <section className="detail-section">
          <h2>Notas</h2>
          <p>{client.notas}</p>
        </section>
      )}

      <section className="detail-section">
        <h2>Vehículos vinculados</h2>

        {(!operations || operations.length === 0) && (
          <p className="empty-state">Este cliente aún no tiene vehículos vinculados.</p>
        )}

        {operations && operations.length > 0 && (
          <ul className="vehicle-list">
            {operations.map((op: any) => (
              <li key={op.id} className="operation-row">
                <Link href={`/dashboard/vehiculos/${op.vehicle.id}`} className="vehicle-card">
                  <div className="vehicle-card-main">
                    <strong>
                      {op.vehicle.marca} {op.vehicle.modelo}
                    </strong>
                    <span className="vehicle-card-sub">{op.vehicle.vin || 'Sin VIN'}</span>
                  </div>
                  <span className="company-tag">{op.vehicle.company?.code}</span>
                </Link>
                <form action={updateOperationEstado.bind(null, op.id)} className="operation-estado-form">
                  <input type="hidden" name="client_id" value={client.id} />
                  <select name="estado" defaultValue={op.estado}>
                    {ESTADOS_OPERACION.map((e) => (
                      <option key={e} value={e}>
                        {ESTADO_OPERACION_LABEL[e]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="secondary-btn">
                    Actualizar
                  </button>
                </form>
                <Link href={`/dashboard/firmas/${op.id}`} className="secondary-btn">
                  Firmar contrato
                </Link>
                <GenerateContractButton
                  vehicleId={op.vehicle.id}
                  vehiculoLabel={`${op.vehicle.marca} ${op.vehicle.modelo}`}
                  clients={[{ id: client.id, nombre: client.nombre }]}
                  precioSugerido={op.vehicle.precio_venta_previsto}
                />
                <UnlinkVehicleButton operationId={op.id} clientId={client.id} />
              </li>
            ))}
          </ul>
        )}

        <div className="link-vehicle-box">
          <h3>Vincular un vehículo</h3>
          {availableVehicles.length === 0 ? (
            <p className="form-note">
              No hay más vehículos disponibles para vincular.
            </p>
          ) : (
            <form action={boundLink} className="link-vehicle-form">
              <select name="vehicle_id" required>
                {availableVehicles.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} {v.vin ? `— ${v.vin}` : ''} — {v.company?.code}
                  </option>
                ))}
              </select>
              <select name="estado" defaultValue="contacto">
                {ESTADOS_OPERACION.map((e) => (
                  <option key={e} value={e}>
                    {ESTADO_OPERACION_LABEL[e]}
                  </option>
                ))}
              </select>
              <button type="submit" className="primary-btn">
                Vincular
              </button>
            </form>
          )}
        </div>
      </section>

      <ClientVehicleDocumentsSection vehiculos={vehiculosConDocs} clienteEmail={client.email} />

      <section className="detail-section">
        <h2>Documentos</h2>
        {otherDocs.length === 0 && (
          <p className="empty-state">Sin documentos todavía.</p>
        )}
        {otherDocs.length > 0 && (
          <ul className="pending-list">
            {otherDocs.map((doc: any) => (
              <li key={doc.id}>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer">{doc.nombre_archivo}</a>
                ) : (
                  doc.nombre_archivo
                )}
                {' — '}
                {new Date(doc.created_at).toLocaleDateString('es-ES')}
                {doc.url && (
                  <>
                    {' · '}
                    <a href={withDownload(doc.url, doc.nombre_archivo)}>Descargar</a>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <Link href={`/dashboard/documentos?cliente=${client.id}`} className="secondary-btn" style={{ display: 'inline-block', marginTop: 10 }}>
          Ir a documentos de este cliente
        </Link>
      </section>

      <section className="detail-section">
        <h2>Contratos firmados</h2>
        {(!signaturesWithUrls || signaturesWithUrls.length === 0) && (
          <p className="empty-state">Sin contratos firmados todavía.</p>
        )}
        {signaturesWithUrls && signaturesWithUrls.length > 0 && (
          <ul className="pending-list">
            {signaturesWithUrls.map((s: any) => (
              <li key={s.id}>
                {s.tipo_contrato === 'reserva' ? 'Contrato de reserva' : 'Contrato de compraventa'}
                {' — firmado el '}
                {new Date(s.fecha_firma).toLocaleDateString('es-ES')}
                {s.url && (
                  <>
                    {' — '}
                    <a href={s.url} target="_blank" rel="noreferrer">Ver firma</a>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="detail-section">
        <h2>WhatsApp</h2>
        <WhatsAppButton
          telefono={client.telefono}
          nombreCliente={client.nombre}
          vehiculoLabel={(() => {
            const vehicle = (operations?.[0] as any)?.vehicle
            return vehicle ? `${vehicle.marca} ${vehicle.modelo}` : undefined
          })()}
        />
      </section>
    </div>
  )
}
