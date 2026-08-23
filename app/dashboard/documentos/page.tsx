import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import DocumentUploadForm from './UploadForm'
import { deleteDocument } from './actions'

const TIPO_LABEL: Record<string, string> = {
  vehiculo: 'Documentación del vehículo',
  factura: 'Factura / gasto',
  contrato_reserva: 'Contrato de reserva',
  contrato_compraventa: 'Contrato de compraventa',
  tramite: 'Trámite',
  otro: 'Otro',
}

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; tipo?: string; vehiculo?: string; cliente?: string }>
}) {
  const { empresa, tipo, vehiculo, cliente } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('user_companies')
    .select('company:companies(id, code, name)')
    .eq('user_id', user.id)
  const companies = (memberships ?? []).map((m: any) => m.company).filter(Boolean)

  if (companies.length === 0) redirect('/dashboard')

  const activeCode = empresa && empresa !== 'TODAS' ? empresa : companies[0]?.code
  const activeCompany = companies.find((c: any) => c.code === activeCode) ?? companies[0]

  const [{ data: vehicles }, { data: clients }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, marca, modelo, vin')
      .eq('company_id', activeCompany.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, nombre')
      .eq('company_id', activeCompany.id)
      .order('created_at', { ascending: false }),
  ])

  let query = supabase
    .from('documents')
    .select('id, tipo, nombre_archivo, storage_path, notas, created_at, vehicle:vehicles(marca, modelo), client:clients(nombre)')
    .eq('company_id', activeCompany.id)
    .order('created_at', { ascending: false })

  if (tipo) query = query.eq('tipo', tipo)
  if (vehiculo) query = query.eq('vehicle_id', vehiculo)
  if (cliente) query = query.eq('client_id', cliente)

  const { data: documents, error } = await query

  // Genera enlaces de descarga temporales (5 min) para cada documento.
  const documentsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc: any) => {
      const { data } = await supabase.storage
        .from('documentos')
        .createSignedUrl(doc.storage_path, 60 * 5)
      return { ...doc, url: data?.signedUrl ?? null }
    })
  )

  return (
    <div className="vehicles-page">
      <h1>Documentos</h1>

      <DocumentUploadForm
        companies={companies}
        defaultCompanyId={activeCompany.id}
        vehicles={vehicles ?? []}
        clients={clients ?? []}
      />

      <section className="detail-section">
        <h2>Filtrar</h2>
        <form className="search-bar" action="/dashboard/documentos" method="get">
          <input type="hidden" name="empresa" value={activeCompany.code} />
          <select name="tipo" defaultValue={tipo ?? ''}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit">Filtrar</button>
        </form>
      </section>

      {error && <p className="login-error">No se han podido cargar los documentos.</p>}

      {!error && documentsWithUrls.length === 0 && (
        <p className="empty-state">No hay documentos con este filtro todavía.</p>
      )}

      <ul className="vehicle-list">
        {documentsWithUrls.map((doc: any) => (
          <li key={doc.id} className="vehicle-card">
            <div className="vehicle-card-main">
              <strong>{doc.nombre_archivo}</strong>
              <span className="vehicle-card-sub">
                {TIPO_LABEL[doc.tipo] ?? doc.tipo}
                {doc.vehicle ? ` · ${doc.vehicle.marca} ${doc.vehicle.modelo}` : ''}
                {doc.client ? ` · ${doc.client.nombre}` : ''}
                {' · '}
                {new Date(doc.created_at).toLocaleDateString('es-ES')}
              </span>
            </div>
            <div className="vehicle-card-side">
              {doc.url && (
                <a href={doc.url} target="_blank" rel="noreferrer" className="secondary-btn">
                  Ver / descargar
                </a>
              )}
              <form action={deleteDocument.bind(null, doc.id, doc.storage_path)}>
                <button type="submit" className="secondary-btn">
                  Eliminar
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
