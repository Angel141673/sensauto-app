// Ficha técnica por vehículo: la única documentación que vive en su propia
// tabla (public.vehicle_documents), porque necesita la estructura de
// país de origen / española × cara A / cara B. El resto de documentación
// del vehículo (contratos, facturas...) vive en public.documents — ver
// lib/documents.ts — para que aparezca tanto en la ficha del vehículo
// como en la pestaña general "Documentos".

export type VehicleDocumentTipo =
  | 'ficha_tecnica_origen_a'
  | 'ficha_tecnica_origen_b'
  | 'ficha_tecnica_espanola_a'
  | 'ficha_tecnica_espanola_b'

export const TIPO_DOCUMENTO_LABEL: Record<VehicleDocumentTipo, string> = {
  ficha_tecnica_origen_a: 'Ficha técnica país de origen (cara A)',
  ficha_tecnica_origen_b: 'Ficha técnica país de origen (cara B)',
  ficha_tecnica_espanola_a: 'Ficha técnica española (cara A)',
  ficha_tecnica_espanola_b: 'Ficha técnica española (cara B)',
}

// Documentos clave para el badge de alerta en la ficha del vehículo: la
// ficha técnica española (las dos caras) es la que hace falta para poder
// matricular/vender el coche en España.
export const TIPOS_CLAVE: VehicleDocumentTipo[] = [
  'ficha_tecnica_espanola_a',
  'ficha_tecnica_espanola_b',
]

export function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
