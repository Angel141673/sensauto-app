// Reglas compartidas de la gestión documental por vehículo: qué tipos
// existen, cómo se llaman en pantalla, cuáles son obligatorios para el
// badge de alerta, y cómo viene marcado el checklist al enviar al cliente.

export type VehicleDocumentTipo =
  | 'contrato_reserva'
  | 'contrato_compraventa'
  | 'factura_compra'
  | 'factura_venta'
  | 'ficha_tecnica_origen_a'
  | 'ficha_tecnica_origen_b'
  | 'ficha_tecnica_espanola_a'
  | 'ficha_tecnica_espanola_b'

export const TIPO_DOCUMENTO_LABEL: Record<VehicleDocumentTipo, string> = {
  contrato_reserva: 'Contrato de reserva',
  contrato_compraventa: 'Contrato de compraventa',
  factura_compra: 'Factura de compra',
  factura_venta: 'Factura de venta',
  ficha_tecnica_origen_a: 'Ficha técnica país de origen (cara A)',
  ficha_tecnica_origen_b: 'Ficha técnica país de origen (cara B)',
  ficha_tecnica_espanola_a: 'Ficha técnica española (cara A)',
  ficha_tecnica_espanola_b: 'Ficha técnica española (cara B)',
}

export const TIPOS_DOCUMENTO: VehicleDocumentTipo[] = [
  'contrato_reserva',
  'contrato_compraventa',
  'factura_compra',
  'factura_venta',
  'ficha_tecnica_origen_a',
  'ficha_tecnica_origen_b',
  'ficha_tecnica_espanola_a',
  'ficha_tecnica_espanola_b',
]

// Documentos clave para el badge de alerta en la ficha del vehículo: la
// ficha técnica española (las dos caras) es la que hace falta para poder
// matricular/vender el coche en España.
export const TIPOS_CLAVE: VehicleDocumentTipo[] = [
  'ficha_tecnica_espanola_a',
  'ficha_tecnica_espanola_b',
]

// Al abrir el modal de envío al cliente, qué viene marcado por defecto.
// factura_compra es un documento interno — nunca marcado por defecto.
export const TIPOS_MARCADOS_POR_DEFECTO: VehicleDocumentTipo[] = [
  'contrato_reserva',
  'contrato_compraventa',
  'factura_venta',
  'ficha_tecnica_origen_a',
  'ficha_tecnica_origen_b',
  'ficha_tecnica_espanola_a',
  'ficha_tecnica_espanola_b',
]

export function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
