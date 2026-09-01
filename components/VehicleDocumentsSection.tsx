'use client'

import { useState } from 'react'
import {
  uploadVehicleDocument,
  deleteVehicleDocument,
} from '@/app/dashboard/vehiculos/[id]/documentos/actions'
import { TIPOS_CLAVE, TIPO_DOCUMENTO_LABEL, type VehicleDocumentTipo } from '@/lib/vehicleDocuments'
import { compressImage } from '@/lib/compressImage'
import { withDownload } from '@/lib/downloadUrl'

type Doc = {
  id: string
  tipo_documento: VehicleDocumentTipo
  nombre_archivo: string
  storage_path: string
  tamano_bytes: number | null
  fecha_subida: string
  url: string | null
}

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
            <>
              <a href={doc.url} target="_blank" rel="noreferrer">
                Ver
              </a>
              <a href={withDownload(doc.url, doc.nombre_archivo)}>Descargar</a>
            </>
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
  documentos,
}: {
  vehicleId: string
  companyId: string
  companyCode: string
  documentos: Doc[]
}) {
  const [slotPendiente, setSlotPendiente] = useState<VehicleDocumentTipo | null>(null)
  const [slotError, setSlotError] = useState<{ tipo: VehicleDocumentTipo; message: string } | null>(null)

  const tiposFaltantes = TIPOS_CLAVE.filter(
    (tipo) => !documentos.some((d) => d.tipo_documento === tipo)
  )

  const acentoEmpresa = companyCode === 'SUNAUTO' ? 'vehicle-documents--sunauto' : 'vehicle-documents--sensauto'

  async function handleSlotUpload(tipo: VehicleDocumentTipo, file: File) {
    setSlotPendiente(tipo)
    setSlotError(null)
    try {
      const comprimido = await compressImage(file)
      const formData = new FormData()
      formData.set('tipo_documento', tipo)
      formData.set('file', comprimido)
      const result = await uploadVehicleDocument(vehicleId, companyId, { status: 'idle' }, formData)
      if (result.status === 'error') {
        setSlotError({ tipo, message: result.message ?? 'No se ha podido subir la foto.' })
      }
    } catch {
      setSlotError({ tipo, message: 'No se ha podido subir la foto. Inténtalo de nuevo.' })
    } finally {
      setSlotPendiente(null)
    }
  }

  return (
    <section className={`detail-section ${acentoEmpresa}`}>
      <div className="vehicles-header">
        <h2>Ficha técnica</h2>
        {tiposFaltantes.length > 0 && (
          <span className="alert-badge">
            Faltan: {tiposFaltantes.map((t) => TIPO_DOCUMENTO_LABEL[t]).join(', ')}
          </span>
        )}
      </div>

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
    </section>
  )
}
