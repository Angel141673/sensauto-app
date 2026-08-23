import { createClient } from '@/lib/supabaseServer'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import VehicleForm from '@/components/VehicleForm'
import { updateVehicle } from '../actions'

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
    .select('id, estado, client:clients(id, nombre, telefono)')
    .eq('vehicle_id', vehicle.id)
    .order('created_at', { ascending: false })

  const { data: documents } = await supabase
    .from('documents')
    .select('id, tipo, nombre_archivo, storage_path, created_at')
    .eq('vehicle_id', vehicle.id)
    .order('created_at', { ascending: false })

  const documentsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc: any) => {
      const { data } = await supabase.storage.from('documentos').createSignedUrl(doc.storage_path, 60 * 5)
      return { ...doc, url: data?.signedUrl ?? null }
    })
  )

  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, proveedor, fecha, total')
    .eq('vehicle_id', vehicle.id)
    .order('fecha', { ascending: false })

  const totalGastos = (expenses ?? []).reduce((acc, e: any) => acc + Number(e.total || 0), 0)

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
        <Link href={`/dashboard/vehiculos/${vehicle.id}?editar=1`} className="primary-btn">
          Editar
        </Link>
      </div>

      <span className={`estado-badge estado-${vehicle.estado}`}>
        {ESTADO_LABEL[vehicle.estado] ?? vehicle.estado}
      </span>

      <section className="detail-section">
        <h2>Identificación</h2>
        <dl className="detail-grid">
          <div><dt>Empresa</dt><dd>{vehicle.company?.name}</dd></div>
          <div><dt>Bastidor / VIN</dt><dd>{vehicle.vin || '—'}</dd></div>
          <div><dt>Matrícula</dt><dd>{vehicle.matricula || '—'}</dd></div>
        </dl>
      </section>

      <section className="detail-section">
        <h2>Datos técnicos</h2>
        <dl className="detail-grid">
          <div><dt>Año</dt><dd>{vehicle.anio ?? '—'}</dd></div>
          <div><dt>Kilómetros</dt><dd>{vehicle.km ?? '—'}</dd></div>
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
        <Link href={`/dashboard/documentos?empresa=${vehicle.company.code}&vehiculo=${vehicle.id}`} className="secondary-btn" style={{ display: 'inline-block', marginTop: 10 }}>
          Ir a documentos de este vehículo
        </Link>
      </section>

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
