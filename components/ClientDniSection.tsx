'use client'

import { useRef, useState } from 'react'
import { useFormState } from 'react-dom'
import { uploadDocument, deleteDocument, type UploadState } from '@/app/dashboard/documentos/actions'
import { compressImage } from '@/lib/compressImage'
import { withDownload } from '@/lib/downloadUrl'

type Doc = {
  id: string
  nombre_archivo: string
  storage_path: string
  created_at: string
  url: string | null
}

type Company = { id: string; code: string; name: string }

const uploadInitialState: UploadState = { status: 'idle' }

export default function ClientDniSection({
  clientId,
  companies,
  defaultCompanyId,
  documentos,
}: {
  clientId: string
  companies: Company[]
  defaultCompanyId: string
  documentos: Doc[]
}) {
  const [state, formAction] = useFormState(uploadDocument, uploadInitialState)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [comprimiendo, setComprimiendo] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      return
    }
    setComprimiendo(true)
    try {
      const comprimido = await compressImage(file)
      setSelectedFile(comprimido)
      if (fileInputRef.current) {
        const dt = new DataTransfer()
        dt.items.add(comprimido)
        fileInputRef.current.files = dt.files
      }
    } finally {
      setComprimiendo(false)
    }
  }

  return (
    <section className="detail-section">
      <h2>DNI / NIF</h2>

      <form
        action={formAction}
        className="link-vehicle-form"
        style={{ marginBottom: 16 }}
        onSubmit={() => {
          if (state.status === 'duplicate') setConfirmando(true)
        }}
      >
        <input type="hidden" name="tipo" value="dni" />
        <input type="hidden" name="client_id" value={clientId} />
        {confirmando && <input type="hidden" name="confirmar_duplicado" value="true" />}
        {companies.length > 1 ? (
          <select name="company_id" defaultValue={defaultCompanyId} required>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="company_id" value={defaultCompanyId} />
        )}
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept="image/*,application/pdf"
          required
          onChange={handleFileChange}
        />
        <button type="submit" className="primary-btn" disabled={!selectedFile || comprimiendo}>
          {comprimiendo ? 'Preparando archivo…' : state.status === 'duplicate' ? 'Sí, subir de todas formas' : 'Subir DNI'}
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
        <p className="empty-state">Sin DNI guardado todavía.</p>
      ) : (
        <ul className="pending-list">
          {documentos.map((doc) => (
            <li key={doc.id} className="vehicle-card">
              <div className="vehicle-card-main">
                <strong>{doc.nombre_archivo}</strong>
                <span className="vehicle-card-sub">{new Date(doc.created_at).toLocaleDateString('es-ES')}</span>
              </div>
              <div className="vehicle-card-side">
                {doc.url && (
                  <>
                    <a href={doc.url} target="_blank" rel="noreferrer" className="secondary-btn">
                      Ver
                    </a>
                    <a href={withDownload(doc.url, doc.nombre_archivo)} className="secondary-btn">
                      Descargar
                    </a>
                  </>
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
    </section>
  )
}
