// Reglas compartidas de la gestión documental por vehículo: qué tipos
// existen, cómo se llaman en pantalla, cuáles son obligatorios para el
// badge de alerta, y cómo viene marcado el checklist al enviar al cliente.

export type VehicleDocumentTipo =
  | 'ficha_tecnica'
  | 'permiso_circulacion'
  | 'itv'
  | 'factura_compra'
  | 'factura_venta'
  | 'contrato_compraventa'
  | 'transferencia_dgt'
  | 'seguro'
  | 'otro'

export const TIPO_DOCUMENTO_LABEL: Record<VehicleDocumentTipo, string> = {
  ficha_tecnica: 'Ficha técnica',
  permiso_circulacion: 'Permiso de circulación',
  itv: 'ITV',
  factura_compra: 'Factura de compra',
  factura_venta: 'Factura de venta',
  contrato_compraventa: 'Contrato de compraventa',
  transferencia_dgt: 'Transferencia DGT',
  seguro: 'Seguro',
  otro: 'Otro',
}

export const TIPOS_DOCUMENTO: VehicleDocumentTipo[] = [
  'ficha_tecnica',
  'permiso_circulacion',
  'itv',
  'factura_compra',
  'factura_venta',
  'contrato_compraventa',
  'transferencia_dgt',
  'seguro',
  'otro',
]

// Documentos clave para el badge de alerta en la ficha del vehículo.
export const TIPOS_CLAVE: VehicleDocumentTipo[] = [
  'ficha_tecnica',
  'permiso_circulacion',
  'itv',
]

// Al abrir el modal de envío al cliente, qué viene marcado por defecto.
// factura_compra es un documento interno — nunca marcado por defecto.
// otro se revisa caso a caso — tampoco marcado por defecto.
export const TIPOS_MARCADOS_POR_DEFECTO: VehicleDocumentTipo[] = [
  'ficha_tecnica',
  'permiso_circulacion',
  'itv',
  'factura_venta',
  'contrato_compraventa',
  'transferencia_dgt',
  'seguro',
]

export function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
