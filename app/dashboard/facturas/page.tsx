import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import SelectCompanyPrompt from '@/components/SelectCompanyPrompt'
import RectificarFacturaButton from '@/components/RectificarFacturaButton'
import { formatNumeroFactura } from '@/lib/invoiceLookup'
import { withDownload } from '@/lib/downloadUrl'

// Registro de todas las facturas de venta y rectificativas emitidas por la
// empresa (public.invoices) — a diferencia de Documentos (que mezcla todos
// los tipos de archivo), aquí se puede auditar de un vistazo que la
// numeración correlativa no tenga huecos ni duplicados.
function detectarHuecos(items: { anio: number; numero: number }[]): string[] {
  const porAnio = new Map<number, number[]>()
  for (const { anio, numero } of items) {
    if (!porAnio.has(anio)) porAnio.set(anio, [])
    porAnio.get(anio)!.push(numero)
  }
  const huecos: string[] = []
  for (const [anio, nums] of porAnio) {
    nums.sort((a, b) => a - b)
    let esperado = 1
    for (const n of nums) {
      if (n !== esperado) {
        huecos.push(`${anio}/${String(esperado).padStart(4, '0')}`)
      }
      esperado = n + 1
    }
  }
  return huecos
}

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>
}) {
  const { empresa } = await searchParams
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

  const activeCompany = companies.find((c: any) => c.code === empresa)

  if (!activeCompany) {
    return (
      <div className="vehicles-page">
        <h1>Facturas</h1>
        <SelectCompanyPrompt companies={companies} basePath="/dashboard/facturas" />
      </div>
    )
  }

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(
      'id, numero, anio, tipo, importe, fecha, rectifica_invoice_id, document:documents(id, nombre_archivo, storage_path), vehicle:vehicles(marca, modelo), client:clients(nombre)'
    )
    .eq('company_id', activeCompany.id)
    .order('anio', { ascending: true })
    .order('numero', { ascending: true })

  const rectificaIds = (invoices ?? []).map((f: any) => f.rectifica_invoice_id).filter(Boolean)
  const { data: originales } =
    rectificaIds.length > 0
      ? await supabase.from('invoices').select('id, numero, anio, tipo').in('id', rectificaIds)
      : { data: [] }
  const originalPorId = new Map((originales ?? []).map((o: any) => [o.id, o]))

  const invoicesConUrl = await Promise.all(
    (invoices ?? []).map(async (inv: any) => {
      const doc = inv.document
      if (!doc) return { ...inv, url: null }
      const { data } = await supabase.storage.from('documentos').createSignedUrl(doc.storage_path, 60 * 5)
      return { ...inv, url: data?.signedUrl ?? null }
    })
  )

  const huecos = detectarHuecos((invoices ?? []).map((f: any) => ({ anio: f.anio, numero: f.numero })))

  return (
    <div className="vehicles-page">
      <h1>Facturas</h1>

      {error && <p className="login-error">No se han podido cargar las facturas.</p>}

      {huecos.length > 0 && (
        <div className="duplicate-warning">
          <p>
            ⚠️ Falta{huecos.length > 1 ? 'n' : ''} en la secuencia: {huecos.join(', ')}. Revisa si alguna factura se
            generó sin guardarse correctamente.
          </p>
        </div>
      )}

      {!error && invoicesConUrl.length === 0 && <p className="empty-state">No hay facturas emitidas todavía.</p>}

      <ul className="vehicle-list">
        {invoicesConUrl.map((inv: any) => {
          const numeroFactura = formatNumeroFactura(inv)
          const original = inv.rectifica_invoice_id ? originalPorId.get(inv.rectifica_invoice_id) : null
          return (
            <li key={inv.id} className="vehicle-card">
              <div className="vehicle-card-main">
                <strong>{numeroFactura}</strong>
                <span className="vehicle-card-sub">
                  {inv.tipo === 'rectificativa' ? 'Factura rectificativa' : 'Factura de venta'}
                  {inv.vehicle ? ` · ${inv.vehicle.marca} ${inv.vehicle.modelo}` : ''}
                  {inv.client ? ` · ${inv.client.nombre}` : ''}
                  {' · '}
                  {inv.importe.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  {' · '}
                  {new Date(inv.fecha).toLocaleDateString('es-ES')}
                  {original ? ` · Rectifica a ${formatNumeroFactura(original)}` : ''}
                </span>
              </div>
              <div className="vehicle-card-side">
                {inv.url && inv.document && (
                  <>
                    <a href={inv.url} target="_blank" rel="noreferrer" className="secondary-btn">
                      Ver
                    </a>
                    <a href={withDownload(inv.url, inv.document.nombre_archivo)} className="secondary-btn">
                      Descargar
                    </a>
                  </>
                )}
                {inv.document && (
                  <RectificarFacturaButton
                    documentId={inv.document.id}
                    facturaLabel={numeroFactura}
                    importeActual={inv.importe}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
