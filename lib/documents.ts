// Tipos de la tabla genérica public.documents — usada por la pestaña
// "Documentos" y, para contratos/facturas del vehículo, también desde la
// ficha del vehículo (mismo tipo, misma tabla: aparece en los dos sitios).

export type DocumentTipo =
  | 'vehiculo'
  | 'factura'
  | 'contrato_reserva'
  | 'contrato_compraventa'
  | 'factura_compra'
  | 'factura_venta'
  | 'tramite'
  | 'otro'
  | 'presupuesto'
  | 'dni'

export const DOCUMENT_TIPO_LABEL: Record<DocumentTipo, string> = {
  vehiculo: 'Documentación del vehículo',
  factura: 'Factura / gasto',
  contrato_reserva: 'Contrato de reserva',
  contrato_compraventa: 'Contrato de compraventa',
  factura_compra: 'Factura de compra',
  factura_venta: 'Factura de venta',
  tramite: 'Trámite',
  otro: 'Otro',
  presupuesto: 'Presupuesto / factura proforma',
  dni: 'DNI / NIF',
}

// Tipos elegibles al subir un documento vinculado a un vehículo desde su
// propia ficha — no incluye "factura" (viene de Gastos) ni "presupuesto"
// (se genera con su propio botón) ni "vehiculo" (categoría genérica sin
// uso real hoy).
export const TIPOS_DOCUMENTO_VEHICULO: DocumentTipo[] = [
  'contrato_reserva',
  'contrato_compraventa',
  'factura_compra',
  'factura_venta',
  'tramite',
  'otro',
]

// Al abrir "Enviar documentación al cliente": qué documentos de
// public.documents vienen marcados por defecto, y si llevan un aviso.
// factura_compra es un documento interno — nunca marcado por defecto.
export function opcionesEnvioParaTipo(tipo: DocumentTipo): { marcadoPorDefecto: boolean; warning?: string } {
  if (tipo === 'factura_compra') {
    return { marcadoPorDefecto: false, warning: '⚠️ Documento interno — normalmente no se envía al cliente' }
  }
  if (tipo === 'contrato_reserva' || tipo === 'contrato_compraventa' || tipo === 'factura_venta') {
    return { marcadoPorDefecto: true }
  }
  return { marcadoPorDefecto: false }
}
