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
  const [tipoSeleccionado, setTipoSeleccionado] = useState<VehicleDocumentTipo>('ficha_tecnica')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)

  const boundUpload = uploadVehicleDocument.bind(null, vehicleId, companyId)
  const [uploadState, uploadAction] = useFormState(boundUpload, uploadInitialState)

  const tiposFaltantes = TIPOS_CLAVE.filter(
    (tipo) => !documentos.some((d) => d.tipo_documento === tipo)
  )

  const puedeEnviar = estado === 'vendido' || estado === 'entregado'

  const acentoEmpresa = companyCode === 'SUNAUTO' ? 'vehicle-documents--sunauto' : 'vehicle-documents--sensauto'

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

      <form action={uploadAction} className="link-vehicle-form" style={{ marginBottom: 16 }}>
        <select
          name="tipo_documento"
          value={tipoSeleccionado}
          onChange={(e) => setTipoSeleccionado(e.target.value as VehicleDocumentTipo)}
        >
          {TIPOS_DOCUMENTO.map((t) => (
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

      {documentos.length === 0 ? (
        <p className="empty-state">Todavía no hay documentos de este vehículo.</p>
      ) : (
        <ul className="pending-list">
          {documentos.map((doc) => (
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
