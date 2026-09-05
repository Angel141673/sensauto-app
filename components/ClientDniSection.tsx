'use client'

import { useState } from 'react'
import { uploadDocument, deleteDocument, type UploadState } from '@/app/dashboard/documentos/actions'
import { compressImage } from '@/lib/compressImage'
import { withDownload } from '@/lib/downloadUrl'

type DniTipo = 'dni_anverso' | 'dni_reverso'

type Doc = {
  id: string
  tipo: DniTipo
  nombre_archivo: string
  storage_path: string
  created_at: string
  url: string | null
}

const SLOTS: { tipo: DniTipo; label: string }[] = [
  { tipo: 'dni_anverso', label: 'Anverso' },
  { tipo: 'dni_reverso', label: 'Reverso' },
]

function esImagen(nombreArchivo: string) {
  return /\.(jpe?g|png|webp|gif|heic)$/i.test(nombreArchivo)
}

function DniSlot({
  tipo,
  label,
  doc,
  onUpload,
  pendiente,
  error,
}: {
  tipo: DniTipo
  label: string
  doc: Doc | undefined
  onUpload: (tipo: DniTipo, file: File) => void
  pendiente: boolean
  error: string | null
}) {
  if (doc) {
    return (
      <div className="ficha-slot ficha-slot-filled">
        {esImagen(doc.nombre_archivo) && doc.url ? (
          <img src={doc.url} alt={label} className="ficha-slot-thumb" />
        ) : (
          <div className="ficha-slot-thumb ficha-slot-thumb-file">📄</div>
        )}
        <span className="ficha-slot-label">{label}</span>
        <div className="ficha-slot-actions">
          {doc.url && (
            <>
              <a href={doc.url} target="_blank" rel="noreferrer">
                Ver
              </a>
              <a href={withDownload(doc.url, doc.nombre_archivo)}>Descargar</a>
            </>
          )}
          <form action={deleteDocument.bind(null, doc.id, doc.storage_path)}>
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
        accept="image/*"
        className="ficha-slot-input"
        disabled={pendiente}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(tipo, file)
          e.target.value = ''
        }}
      />
      <span className="ficha-slot-icon">{pendiente ? '…' : '+'}</span>
      <span className="ficha-slot-label">{label}</span>
      <span className="ficha-slot-hint">{pendiente ? 'Subiendo…' : 'Subir foto'}</span>
      {error && <span className="ficha-slot-error">{error}</span>}
    </label>
  )
}

export default function ClientDniSection({
  clientId,
  defaultCompanyId,
  documentos,
}: {
  clientId: string
  defaultCompanyId: string
  documentos: Doc[]
}) {
  const [slotPendiente, setSlotPendiente] = useState<DniTipo | null>(null)
  const [slotError, setSlotError] = useState<{ tipo: DniTipo; message: string } | null>(null)
  const [pendienteConfirmar, setPendienteConfirmar] = useState<{ tipo: DniTipo; file: File; mensaje: string } | null>(
    null
  )

  const anverso = documentos.find((d) => d.tipo === 'dni_anverso')
  const reverso = documentos.find((d) => d.tipo === 'dni_reverso')
  const completo = Boolean(anverso && reverso)

  async function subir(tipo: DniTipo, file: File, confirmarDuplicado: boolean) {
    const formData = new FormData()
    formData.set('tipo', tipo)
    formData.set('client_id', clientId)
    formData.set('company_id', defaultCompanyId)
    formData.set('file', file)
    if (confirmarDuplicado) formData.set('confirmar_duplicado', 'true')
    return uploadDocument({ status: 'idle' }, formData)
  }

  async function handleUpload(tipo: DniTipo, file: File) {
    setSlotPendiente(tipo)
    setSlotError(null)
    setPendienteConfirmar(null)
    try {
      const comprimido = await compressImage(file)
      const result = await subir(tipo, comprimido, false)
      if (result.status === 'error') {
        setSlotError({ tipo, message: result.message ?? 'No se ha podido subir la foto.' })
      } else if (result.status === 'duplicate') {
        setPendienteConfirmar({ tipo, file: comprimido, mensaje: result.message ?? '' })
      }
    } catch {
      setSlotError({ tipo, message: 'No se ha podido subir la foto. Inténtalo de nuevo.' })
    } finally {
      setSlotPendiente(null)
    }
  }

  async function handleConfirmarDuplicado() {
    if (!pendienteConfirmar) return
    const { tipo, file } = pendienteConfirmar
    setSlotPendiente(tipo)
    try {
      const result = await subir(tipo, file, true)
      if (result.status === 'error') {
        setSlotError({ tipo, message: result.message ?? 'No se ha podido subir la foto.' })
      }
    } catch {
      setSlotError({ tipo, message: 'No se ha podido subir la foto. Inténtalo de nuevo.' })
    } finally {
      setSlotPendiente(null)
      setPendienteConfirmar(null)
    }
  }

  return (
    <section className="detail-section">
      <div className="vehicles-header">
        <h2>DNI / NIF</h2>
        {completo && (
          <a href={`/api/clientes/${clientId}/dni-pdf`} className="secondary-btn">
            Descargar DNI a tamaño real (PDF)
          </a>
        )}
      </div>

      {pendienteConfirmar && (
        <div className="duplicate-warning">
          <p>{pendienteConfirmar.mensaje}</p>
          <button type="button" className="secondary-btn" onClick={handleConfirmarDuplicado}>
            Sí, subir de todas formas
          </button>
        </div>
      )}

      <div className="ficha-slot-grid">
        {SLOTS.map((slot) => (
          <DniSlot
            key={slot.tipo}
            tipo={slot.tipo}
            label={slot.label}
            doc={slot.tipo === 'dni_anverso' ? anverso : reverso}
            onUpload={handleUpload}
            pendiente={slotPendiente === slot.tipo}
            error={slotError?.tipo === slot.tipo ? slotError.message : null}
          />
        ))}
      </div>
    </section>
  )
}
