'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import {
  sendVehicleDocumentsEmail,
  type SendDocumentsState,
} from '@/app/dashboard/vehiculos/[id]/documentos/actions'
import {
  TIPO_DOCUMENTO_LABEL,
  TIPOS_MARCADOS_POR_DEFECTO,
  type VehicleDocumentTipo,
} from '@/lib/vehicleDocuments'

type Doc = { id: string; tipo_documento: VehicleDocumentTipo; nombre_archivo: string }

const sendInitialState: SendDocumentsState = { status: 'idle' }

export default function SendDocumentsModal({
  vehicleId,
  vehiculoLabel,
  documentos,
  clienteEmail,
  onClose,
}: {
  vehicleId: string
  vehiculoLabel: string
  documentos: Doc[]
  clienteEmail: string | null
  onClose: () => void
}) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(
    new Set(documentos.filter((d) => TIPOS_MARCADOS_POR_DEFECTO.includes(d.tipo_documento)).map((d) => d.id))
  )
  const [email, setEmail] = useState(clienteEmail ?? '')
  const [asunto, setAsunto] = useState(`Documentación de tu vehículo — ${vehiculoLabel}`)
  const [descargando, setDescargando] = useState(false)
  const [descargaError, setDescargaError] = useState<string | null>(null)

  const boundSend = sendVehicleDocumentsEmail.bind(null, vehicleId)
  const [sendState, sendAction] = useFormState(boundSend, sendInitialState)

  function toggle(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDescargarZip() {
    if (seleccionados.size === 0) {
      setDescargaError('Selecciona al menos un documento.')
      return
    }
    setDescargando(true)
    setDescargaError(null)
    try {
      const res = await fetch(`/api/vehiculos/${vehicleId}/documentos-zip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_ids: Array.from(seleccionados) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setDescargaError(body?.error ?? 'No se ha podido generar el ZIP.')
        return
      }
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="(.+)"/)
      const filename = match?.[1] ?? 'documentacion.zip'
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setDescargaError('No se ha podido generar el ZIP. Inténtalo de nuevo.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Enviar documentación al cliente</h2>
        <p className="form-note">Vehículo: {vehiculoLabel}</p>

        <div className="form-field">
          <label>Documentos a incluir</label>
          <ul className="checklist">
            {documentos.map((d) => (
              <li key={d.id}>
                <label className="checklist-item">
                  <input
                    type="checkbox"
                    checked={seleccionados.has(d.id)}
                    onChange={() => toggle(d.id)}
                  />
                  {TIPO_DOCUMENTO_LABEL[d.tipo_documento]} — {d.nombre_archivo}
                  {d.tipo_documento === 'factura_compra' && (
                    <span className="warning-tag">⚠️ Documento interno — normalmente no se envía al cliente</span>
                  )}
                  {d.tipo_documento === 'otro' && <span className="warning-tag">Revisar caso a caso</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>

        <form action={sendAction}>
          {Array.from(seleccionados).map((id) => (
            <input key={id} type="hidden" name="document_ids" value={id} />
          ))}

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="email">Destinatario</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="asunto">Asunto</label>
              <input id="asunto" name="asunto" required value={asunto} onChange={(e) => setAsunto(e.target.value)} />
            </div>
          </div>

          {descargaError && <p className="login-error">{descargaError}</p>}
          {sendState.status === 'error' && <p className="login-error">{sendState.message}</p>}
          {sendState.status === 'success' && <p className="success-note">{sendState.message}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cerrar
            </button>
            <button type="button" className="secondary-btn" onClick={handleDescargarZip} disabled={descargando}>
              {descargando ? 'Generando…' : 'Descargar ZIP'}
            </button>
            <button type="submit" className="primary-btn" disabled={seleccionados.size === 0}>
              Enviar por email
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
