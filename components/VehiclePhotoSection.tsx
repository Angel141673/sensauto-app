'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import {
  uploadVehiclePhoto,
  deleteVehiclePhoto,
  type UploadPhotoState,
} from '@/app/dashboard/vehiculos/actions'

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

  const boundUpload = uploadVehiclePhoto.bind(null, vehicleId, companyId, fotoPath)
  const [uploadState, uploadAction] = useFormState(boundUpload, uploadInitialState)
  const boundDelete = deleteVehiclePhoto.bind(null, vehicleId, fotoPath ?? '')

  return (
    <section className="detail-section vehicle-photo-section">
      {fotoUrl ? (
        <div className="vehicle-photo-current">
          <img src={fotoUrl} alt="Foto del vehículo" className="vehicle-photo-img" />
          <form action={boundDelete}>
            <button type="submit" className="secondary-btn">
              Quitar foto
            </button>
          </form>
        </div>
      ) : (
        <p className="empty-state">Sin foto todavía.</p>
      )}

      <form action={uploadAction} className="vehicle-photo-upload-form">
        <input
          type="file"
          name="file"
          accept="image/*"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" className="secondary-btn" disabled={!selectedFile}>
          {fotoUrl ? 'Reemplazar foto' : 'Subir foto'}
        </button>
      </form>

      {uploadState.status === 'error' && <p className="login-error">{uploadState.message}</p>}
    </section>
  )
}
