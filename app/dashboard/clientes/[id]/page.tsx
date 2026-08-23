import { createClient } from '@/lib/supabaseServer'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ClientForm from '@/components/ClientForm'
import WhatsAppButton from '@/components/WhatsAppButton'
import { updateClientRecord, linkVehicleToClient, updateOperationEstado } from '../actions'

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
    .select('id, estado, created_at, vehicle:vehicles(id, marca, modelo, vin, estado, company:companies(code))')
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
      const { data } = await supabase.storage.from('documentos').createSignedUrl(doc.storage_path, 60 * 5)
      return { ...doc, url: data?.signedUrl ?? null }
    })
  )

  const { data: signatures } = await supabase
    .from('signatures')
    .select('id, tipo_contrato, fecha_firma, storage_path')
    .eq('client_id', client.id)
    .order('fecha_firma', { ascending: false })

  const signaturesWithUrls = await Promise.all(
    (signatures ?? []).map(async (s: any) => {
      const { data } = await supabase.storage.from('firmas').createSignedUrl(s.storage_path, 60 * 5)
      return { ...s, url: data?.signedUrl ?? null }
    })
  )

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
        <Link href={`/dashboard/clientes/${client.id}?editar=1`} className="primary-btn">
          Editar
        </Link>
      </div>

      <section className="detail-section">
        <h2>Datos</h2>
        <dl className="detail-grid">
          <div><dt>Teléfono</dt><dd>{client.telefono || '—'}</dd></div>
          <div><dt>Email</dt><dd>{client.email || '—'}</dd></div>
          <div><dt>DNI / NIF</dt><dd>{client.dni_nif || '—'}</dd></div>
          <div><dt>Dirección</dt><dd>{client.direccion || '—'}</dd></div>
        </dl>
      </section>

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

      <section className="detail-section">
        <h2>Documentos</h2>
        {documentsWithUrls.length === 0 && (
          <p className="empty-state">Sin documentos todavía.</p>
        )}
        {documentsWithUrls.length > 0 && (
          <ul className="pending-list">
            {documentsWithUrls.map((doc: any) => (
              <li key={doc.id}>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer">{doc.nombre_archivo}</a>
                ) : (
                  doc.nombre_archivo
                )}
                {' — '}
                {new Date(doc.created_at).toLocaleDateString('es-ES')}
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
