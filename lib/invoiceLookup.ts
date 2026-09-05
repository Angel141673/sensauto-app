import type { createClient } from './supabaseServer'

export type InvoiceInfo = {
  id: string
  document_id: string
  numero: number
  anio: number
  tipo: 'venta' | 'rectificativa'
  importe: number
  rectifica_invoice_id: string | null
}

export function formatNumeroFactura(info: Pick<InvoiceInfo, 'anio' | 'numero' | 'tipo'>): string {
  const base = `${info.anio}/${String(info.numero).padStart(4, '0')}`
  return info.tipo === 'rectificativa' ? `R-${base}` : base
}

// Las facturas viven en public.invoices, enlazadas a su PDF por
// document_id — esta función arma el mapa documento → factura para
// las pantallas que listan public.documents (Documentos, ficha del
// vehículo) y necesitan mostrar el número/importe junto al archivo.
export async function getInvoicesByDocumentIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentIds: string[]
): Promise<Map<string, InvoiceInfo>> {
  if (documentIds.length === 0) return new Map()
  const { data } = await supabase
    .from('invoices')
    .select('id, document_id, numero, anio, tipo, importe, rectifica_invoice_id')
    .in('document_id', documentIds)
  return new Map((data ?? []).map((inv: any) => [inv.document_id as string, inv as InvoiceInfo]))
}
