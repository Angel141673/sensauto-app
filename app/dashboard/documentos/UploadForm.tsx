'use client'

import { useRef, useState } from 'react'
import { useFormState } from 'react-dom'
import { uploadDocument, type UploadState } from './actions'
import { DOCUMENT_TIPO_LABEL, TIPOS_DOCUMENTO_VEHICULO } from '@/lib/documents'
import { compressImage } from '@/lib/compressImage'

// "Factura / gasto" no está aquí a propósito: esas facturas se registran
// desde Gastos (que crea su propio documento vinculado), para que el
// total cuente en inversión/márgenes. "Factura proforma" tampoco está: se
// genera desde la ficha del vehículo (botón "Generar factura proforma"),
// que ya lo guarda aquí automáticamente.
const TIPOS = [
  { value: 'vehiculo', label: DOCUMENT_TIPO_LABEL.vehiculo },
  ...TIPOS_DOCUMENTO_VEHICULO.map((value) => ({ value, label: DOCUMENT_TIPO_LABEL[value] })),
]

type Company = { id: string; code: string; name: string }
type Vehicle = { id: string; marca: string; modelo: string; vin: string | null }
type Client = { id: string; nombre: string }

const initialState: UploadState = { status: 'idle' }

export default function DocumentUploadForm({
  companies,
  defaultCompanyId,
  vehicles,
  clients,
  presetVehicleId,
  presetClientId,
}: {
  companies: Company[]
  defaultCompanyId: string
  vehicles: Vehicle[]
  clients: Client[]
  presetVehicleId?: string
  presetClientId?: string
}) {
  const [state, formAction] = useFormState(uploadDocument, initialState)
  const [confirmando, setConfirmando] = useState(false)
  const [comprimiendo, setComprimiendo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Las fotos de cámara de móvil pesan varios MB — se comprimen aquí antes
  // de enviar el formulario, para no chocar con el límite de tamaño de las
  // Server Actions (la subida se quedaría colgada sin avisar).
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !fileInputRef.current) return
    setComprimiendo(true)
    try {
      const comprimido = await compressImage(file)
      const dt = new DataTransfer()
      dt.items.add(comprimido)
      fileInputRef.current.files = dt.files
    } finally {
      setComprimiendo(false)
    }
  }

  return (
    <form
      action={formAction}
      className="vehicle-form"
      onSubmit={() => {
        // Tras un aviso de duplicado, el siguiente envío ya lleva confirmación.
        if (state.status === 'duplicate') setConfirmando(true)
      }}
    >
      <section className="form-section">
        <h2>Subir documento</h2>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="company_id">Empresa *</label>
            <select id="company_id" name="company_id" defaultValue={defaultCompanyId} required>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="tipo">Tipo de documento *</label>
            <select id="tipo" name="tipo" required>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {vehicles.length > 0 && (
            <div className="form-field">
              <label htmlFor="vehicle_id">Vehículo (opcional)</label>
              <select id="vehicle_id" name="vehicle_id" defaultValue={presetVehicleId ?? ''}>
                <option value="">— Sin vincular —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} {v.vin ? `— ${v.vin}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {clients.length > 0 && (
            <div className="form-field">
              <label htmlFor="client_id">Cliente (opcional)</label>
              <select id="client_id" name="client_id" defaultValue={presetClientId ?? ''}>
                <option value="">— Sin vincular —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="form-field" style={{ marginTop: 14 }}>
          <label htmlFor="file">Archivo *</label>
          <input
            ref={fileInputRef}
            id="file"
            name="file"
            type="file"
            accept="image/*,application/pdf"
            required
            onChange={handleFileChange}
          />
        </div>

        <div className="form-field" style={{ marginTop: 14 }}>
          <label htmlFor="notas">Notas</label>
          <textarea id="notas" name="notas" rows={2} />
        </div>
      </section>

      {state.status === 'duplicate' && (
        <div className="duplicate-warning">
          <p>{state.message}</p>
          <input type="hidden" name="confirmar_duplicado" value="true" />
          <button type="submit" className="secondary-btn">
            Sí, subir de todas formas
          </button>
        </div>
      )}

      {state.status === 'error' && <p className="login-error">{state.message}</p>}
      {state.status === 'success' && <p className="success-note">{state.message}</p>}

      {state.status !== 'duplicate' && (
        <button type="submit" className="primary-btn" disabled={comprimiendo}>
          {comprimiendo ? 'Preparando archivo…' : 'Subir documento'}
        </button>
      )}
    </form>
  )
}
