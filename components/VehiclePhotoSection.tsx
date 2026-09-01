'use client'

import { useRef, useState } from 'react'
import { useFormState } from 'react-dom'
import {
  uploadVehiclePhoto,
  deleteVehiclePhoto,
  type UploadPhotoState,
} from '@/app/dashboard/vehiculos/actions'
import { compressImage } from '@/lib/compressImage'
import { withDownload } from '@/lib/downloadUrl'

const uploadInitialState: UploadPhotoState = { status: 'idle' }

export default function VehiclePhotoSection({
  vehicleId,
  companyId,
  fotoPath,
  fotoUrl,
}: {
  vehicleId: string
  companyId: string
  fotoPath: string | null
  fotoUrl: string | null
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [comprimiendo, setComprimiendo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const boundUpload = uploadVehiclePhoto.bind(null, vehicleId, companyId, fotoPath)
  const [uploadState, uploadAction] = useFormState(boundUpload, uploadInitialState)
  const boundDelete = deleteVehiclePhoto.bind(null, vehicleId, fotoPath ?? '')

  // Las fotos de cámara de móvil pesan varios MB — se comprimen aquí antes
  // de que el <form> las envíe, para no chocar con el límite de tamaño de
  // las Server Actions (la subida se quedaría colgada sin avisar).
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
    <section className="detail-section vehicle-photo-section">
      {fotoUrl ? (
        <div className="vehicle-photo-current">
          <img src={fotoUrl} alt="Foto del vehículo" className="vehicle-photo-img" />
          <div className="modal-actions">
            <a href={fotoUrl} target="_blank" rel="noreferrer" className="secondary-btn">
              Ver
            </a>
            <a href={withDownload(fotoUrl, 'foto-vehiculo.jpg')} className="secondary-btn">
              Descargar
            </a>
            <form action={boundDelete}>
              <button type="submit" className="secondary-btn">
                Quitar foto
              </button>
            </form>
          </div>
        </div>
      ) : (
        <p className="empty-state">Sin foto todavía.</p>
      )}

      <form action={uploadAction} className="vehicle-photo-upload-form">
        <input ref={fileInputRef} type="file" name="file" accept="image/*" onChange={handleFileChange} />
        <button type="submit" className="secondary-btn" disabled={!selectedFile || comprimiendo}>
          {comprimiendo ? 'Preparando foto…' : fotoUrl ? 'Reemplazar foto' : 'Subir foto'}
        </button>
      </form>

      {uploadState.status === 'error' && <p className="login-error">{uploadState.message}</p>}
    </section>
  )
}
