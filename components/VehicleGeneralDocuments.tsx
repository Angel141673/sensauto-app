'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { uploadDocument, deleteDocument, type UploadState } from '@/app/dashboard/documentos/actions'
import { DOCUMENT_TIPO_LABEL, TIPOS_DOCUMENTO_VEHICULO } from '@/lib/documents'
import SendDocumentsModal, { type SendableDoc } from './SendDocumentsModal'

type Doc = {
  id: string
  tipo: string
  nombre_archivo: string
  storage_path: string
  created_at: string
  url: string | null
}

const uploadInitialState: UploadState = { status: 'idle' }

export default function VehicleGeneralDocuments({
  vehicleId,
  companyId,
  vehiculoLabel,
  estado,
  documentos,
  sendableDocs,
  clienteEmail,
}: {
  vehicleId: string
  companyId: string
  vehiculoLabel: string
  estado: string
  documentos: Doc[]
  sendableDocs: SendableDoc[]
  clienteEmail: string | null
}) {
  const [state, formAction] = useFormState(uploadDocument, uploadInitialState)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const puedeEnviar = (estado === 'vendido' || estado === 'entregado') && sendableDocs.length > 0

  return (
    <section className="detail-section">
      <h2>Documentos</h2>

      <form
        action={formAction}
        className="link-vehicle-form"
        style={{ marginBottom: 16 }}
        onSubmit={() => {
          if (state.status === 'duplicate') setConfirmando(true)
        }}
      >
        <input type="hidden" name="company_id" value={companyId} />
        <input type="hidden" name="vehicle_id" value={vehicleId} />
        {confirmando && <input type="hidden" name="confirmar_duplicado" value="true" />}
        <select name="tipo" defaultValue={TIPOS_DOCUMENTO_VEHICULO[0]} required>
          {TIPOS_DOCUMENTO_VEHICULO.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TIPO_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          type="file"
          name="file"
          accept="image/*,application/pdf"
          required
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" className="primary-btn" disabled={!selectedFile}>
          {state.status === 'duplicate' ? 'Sí, subir de todas formas' : 'Subir documento'}
        </button>
      </form>

      {state.status === 'duplicate' && (
        <div className="duplicate-warning">
          <p>{state.message}</p>
        </div>
      )}
      {state.status === 'error' && <p className="login-error">{state.message}</p>}
      {state.status === 'success' && <p className="success-note">{state.message}</p>}

      {documentos.length === 0 ? (
        <p className="empty-state">Sin documentos todavía.</p>
      ) : (
        <ul className="pending-list">
          {documentos.map((doc) => (
            <li key={doc.id} className="vehicle-card">
              <div className="vehicle-card-main">
                <strong>{DOCUMENT_TIPO_LABEL[doc.tipo as keyof typeof DOCUMENT_TIPO_LABEL] ?? doc.tipo}</strong>
                <span className="vehicle-card-sub">
                  {doc.nombre_archivo} · {new Date(doc.created_at).toLocaleDateString('es-ES')}
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
      )}

      {puedeEnviar && (
        <button type="button" className="primary-btn" style={{ marginTop: 14 }} onClick={() => setModalAbierto(true)}>
          Enviar documentación al cliente
        </button>
      )}

      {modalAbierto && (
        <SendDocumentsModal
          vehicleId={vehicleId}
          vehiculoLabel={vehiculoLabel}
          documentos={sendableDocs}
          clienteEmail={clienteEmail}
          onClose={() => setModalAbierto(false)}
        />
      )}
    </section>
  )
}
