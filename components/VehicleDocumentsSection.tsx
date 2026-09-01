'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import {
  uploadVehicleDocument,
  deleteVehicleDocument,
  type UploadDocState,
} from '@/app/dashboard/vehiculos/[id]/documentos/actions'
import {
  TIPO_DOCUMENTO_LABEL,
  TIPOS_DOCUMENTO,
  TIPOS_CLAVE,
  formatBytes,
  type VehicleDocumentTipo,
} from '@/lib/vehicleDocuments'
import SendDocumentsModal from './SendDocumentsModal'

type Doc = {
  id: string
  tipo_documento: VehicleDocumentTipo
  nombre_archivo: string
  storage_path: string
  tamano_bytes: number | null
  fecha_subida: string
  url: string | null
}

const uploadInitialState: UploadDocState = { status: 'idle' }

const FICHA_TECNICA_ROWS: { titulo: string; slots: { tipo: VehicleDocumentTipo; cara: string }[] }[] = [
  {
    titulo: 'País de origen',
    slots: [
      { tipo: 'ficha_tecnica_origen_a', cara: 'Cara A' },
      { tipo: 'ficha_tecnica_origen_b', cara: 'Cara B' },
    ],
  },
  {
    titulo: 'España',
    slots: [
      { tipo: 'ficha_tecnica_espanola_a', cara: 'Cara A' },
      { tipo: 'ficha_tecnica_espanola_b', cara: 'Cara B' },
    ],
  },
]

const FICHA_TECNICA_TIPOS = FICHA_TECNICA_ROWS.flatMap((row) => row.slots.map((s) => s.tipo))
const OTROS_TIPOS = TIPOS_DOCUMENTO.filter((t) => !FICHA_TECNICA_TIPOS.includes(t))

function esImagen(nombreArchivo: string) {
  return /\.(jpe?g|png|webp|gif|heic)$/i.test(nombreArchivo)
}

function FichaTecnicaSlot({
  tipo,
  cara,
  doc,
  vehicleId,
  onUpload,
  pendiente,
  error,
}: {
  tipo: VehicleDocumentTipo
  cara: string
  doc: Doc | undefined
  vehicleId: string
  onUpload: (tipo: VehicleDocumentTipo, file: File) => void
  pendiente: boolean
  error: string | null
}) {
  if (doc) {
    return (
      <div className="ficha-slot ficha-slot-filled">
        {esImagen(doc.nombre_archivo) && doc.url ? (
          <img src={doc.url} alt={cara} className="ficha-slot-thumb" />
        ) : (
          <div className="ficha-slot-thumb ficha-slot-thumb-file">📄</div>
        )}
        <span className="ficha-slot-label">{cara}</span>
        <div className="ficha-slot-actions">
          {doc.url && (
            <a href={doc.url} target="_blank" rel="noreferrer">
              Ver
            </a>
          )}
          <form action={deleteVehicleDocument.bind(null, doc.id, doc.storage_path, vehicleId)}>
            <button type="submit">Quitar</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <label className="ficha-slot ficha-slot-empty">
      <input
        type="file"
        accept="image/*,application/pdf"
        className="ficha-slot-input"
        disabled={pendiente}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(tipo, file)
          e.target.value = ''
        }}
      />
      <span className="ficha-slot-icon">{pendiente ? '…' : '+'}</span>
      <span className="ficha-slot-label">{cara}</span>
      <span className="ficha-slot-hint">{pendiente ? 'Subiendo…' : 'Subir foto'}</span>
      {error && <span className="ficha-slot-error">{error}</span>}
    </label>
  )
}

export default function VehicleDocumentsSection({
  vehicleId,
  companyId,
  companyCode,
  vehiculoLabel,
  estado,
  documentos,
  clienteEmail,
}: {
  vehicleId: string
  companyId: string
  companyCode: string
  vehiculoLabel: string
  estado: string
  documentos: Doc[]
  clienteEmail: string | null
}) {
  const [tipoSeleccionado, setTipoSeleccionado] = useState<VehicleDocumentTipo>(OTROS_TIPOS[0])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [slotPendiente, setSlotPendiente] = useState<VehicleDocumentTipo | null>(null)
  const [slotError, setSlotError] = useState<{ tipo: VehicleDocumentTipo; message: string } | null>(null)

  const boundUpload = uploadVehicleDocument.bind(null, vehicleId, companyId)
  const [uploadState, uploadAction] = useFormState(boundUpload, uploadInitialState)

  const tiposFaltantes = TIPOS_CLAVE.filter(
    (tipo) => !documentos.some((d) => d.tipo_documento === tipo)
  )

  const puedeEnviar = estado === 'vendido' || estado === 'entregado'

  const acentoEmpresa = companyCode === 'SUNAUTO' ? 'vehicle-documents--sunauto' : 'vehicle-documents--sensauto'

  const otrosDocumentos = documentos.filter((d) => !FICHA_TECNICA_TIPOS.includes(d.tipo_documento))

  async function handleSlotUpload(tipo: VehicleDocumentTipo, file: File) {
    setSlotPendiente(tipo)
    setSlotError(null)
    const formData = new FormData()
    formData.set('tipo_documento', tipo)
    formData.set('file', file)
    const result = await uploadVehicleDocument(vehicleId, companyId, uploadInitialState, formData)
    setSlotPendiente(null)
    if (result.status === 'error') {
      setSlotError({ tipo, message: result.message ?? 'No se ha podido subir la foto.' })
    }
  }

  return (
    <section className={`detail-section ${acentoEmpresa}`}>
      <div className="vehicles-header">
        <h2>Documentación del vehículo</h2>
        {tiposFaltantes.length > 0 && (
          <span className="alert-badge">
            Faltan: {tiposFaltantes.map((t) => TIPO_DOCUMENTO_LABEL[t]).join(', ')}
          </span>
        )}
      </div>

      <h3 className="ficha-tecnica-heading">Ficha técnica</h3>
      {FICHA_TECNICA_ROWS.map((row) => (
        <div key={row.titulo} className="ficha-tecnica-row">
          <span className="ficha-tecnica-row-label">{row.titulo}</span>
          <div className="ficha-slot-grid">
            {row.slots.map((slot) => (
              <FichaTecnicaSlot
                key={slot.tipo}
                tipo={slot.tipo}
                cara={slot.cara}
                doc={documentos.find((d) => d.tipo_documento === slot.tipo)}
                vehicleId={vehicleId}
                onUpload={handleSlotUpload}
                pendiente={slotPendiente === slot.tipo}
                error={slotError?.tipo === slot.tipo ? slotError.message : null}
              />
            ))}
          </div>
        </div>
      ))}

      <h3 className="ficha-tecnica-heading">Otros documentos</h3>
      <form action={uploadAction} className="link-vehicle-form" style={{ marginBottom: 16 }}>
        <select
          name="tipo_documento"
          value={tipoSeleccionado}
          onChange={(e) => setTipoSeleccionado(e.target.value as VehicleDocumentTipo)}
        >
          {OTROS_TIPOS.map((t) => (
            <option key={t} value={t}>
              {TIPO_DOCUMENTO_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          type="file"
          name="file"
          required
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" className="primary-btn" disabled={!selectedFile}>
          Subir documento
        </button>
      </form>

      {uploadState.status === 'error' && <p className="login-error">{uploadState.message}</p>}
      {uploadState.status === 'success' && <p className="success-note">{uploadState.message}</p>}

      {otrosDocumentos.length === 0 ? (
        <p className="empty-state">Todavía no hay otros documentos de este vehículo.</p>
      ) : (
        <ul className="pending-list">
          {otrosDocumentos.map((doc) => (
            <li key={doc.id} className="vehicle-card">
              <div className="vehicle-card-main">
                <strong>{TIPO_DOCUMENTO_LABEL[doc.tipo_documento]}</strong>
                <span className="vehicle-card-sub">
                  {doc.nombre_archivo} · {formatBytes(doc.tamano_bytes)} ·{' '}
                  {new Date(doc.fecha_subida).toLocaleDateString('es-ES')}
                </span>
              </div>
              <div className="vehicle-card-side">
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="secondary-btn">
                    Ver / descargar
                  </a>
                )}
                <form action={deleteVehicleDocument.bind(null, doc.id, doc.storage_path, vehicleId)}>
                  <button type="submit" className="secondary-btn">
                    Eliminar
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {puedeEnviar && documentos.length > 0 && (
        <button type="button" className="primary-btn" style={{ marginTop: 14 }} onClick={() => setModalAbierto(true)}>
          Enviar documentación al cliente
        </button>
      )}

      {modalAbierto && (
        <SendDocumentsModal
          vehicleId={vehicleId}
          vehiculoLabel={vehiculoLabel}
          documentos={documentos}
          clienteEmail={clienteEmail}
          onClose={() => setModalAbierto(false)}
        />
      )}
    </section>
  )
}
