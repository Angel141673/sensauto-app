'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SignaturePad from '@/components/SignaturePad'
import { saveSignature } from './actions'

const TEXTOS_ACEPTACION: Record<string, string> = {
  reserva:
    'El cliente confirma la reserva del vehículo indicado y acepta las condiciones de reserva de SENSAUTO/SUNAUTO. La firma que aparece a continuación tiene la misma validez que una firma manuscrita en papel.',
  compraventa:
    'El cliente confirma la compraventa del vehículo indicado en las condiciones acordadas y acepta el contrato de compraventa de SENSAUTO/SUNAUTO. La firma que aparece a continuación tiene la misma validez que una firma manuscrita en papel.',
}

export default function SignatureCaptureForm({
  companyId,
  companyName,
  operationId,
  clientId,
  clientNombre,
  vehicleLabel,
}: {
  companyId: string
  companyName: string
  operationId: string
  clientId: string
  clientNombre: string
  vehicleLabel: string
}) {
  const router = useRouter()
  const [tipoContrato, setTipoContrato] = useState<'reserva' | 'compraventa'>('reserva')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!blob) {
      setError('Falta capturar la firma en el recuadro.')
      return
    }

    setSaving(true)
    const formData = new FormData()
    formData.set('company_id', companyId)
    formData.set('operation_id', operationId)
    formData.set('client_id', clientId)
    formData.set('tipo_contrato', tipoContrato)
    formData.set('texto_aceptacion', TEXTOS_ACEPTACION[tipoContrato])
    formData.set('signature', blob, 'firma.png')

    try {
      await saveSignature(formData)
    } catch (err: any) {
      setSaving(false)
      setError(err?.message ?? 'No se ha podido guardar la firma.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="vehicle-form">
      <section className="form-section">
        <h2>Firma de contrato</h2>
        <dl className="detail-grid">
          <div><dt>Empresa</dt><dd>{companyName}</dd></div>
          <div><dt>Cliente</dt><dd>{clientNombre}</dd></div>
          <div><dt>Vehículo</dt><dd>{vehicleLabel}</dd></div>
        </dl>

        <div className="form-field" style={{ marginTop: 14 }}>
          <label htmlFor="tipo_contrato">Tipo de contrato</label>
          <select
            id="tipo_contrato"
            value={tipoContrato}
            onChange={(e) => setTipoContrato(e.target.value as 'reserva' | 'compraventa')}
          >
            <option value="reserva">Contrato de reserva</option>
            <option value="compraventa">Contrato de compraventa</option>
          </select>
        </div>
      </section>

      <section className="form-section">
        <h2>Texto de aceptación</h2>
        <p className="form-note">{TEXTOS_ACEPTACION[tipoContrato]}</p>
        <p className="form-note">Sello corporativo: SENSAUTO Motor · SUNAUTO — firma digital archivada con fecha.</p>
      </section>

      <section className="form-section">
        <h2>Firma del cliente</h2>
        <SignaturePad onChange={setBlob} />
      </section>

      {error && <p className="login-error">{error}</p>}

      <button type="submit" className="primary-btn" disabled={saving}>
        {saving ? 'Guardando…' : 'Confirmar y guardar firma'}
      </button>
    </form>
  )
}
