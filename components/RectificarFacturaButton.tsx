'use client'

import { useState } from 'react'

// Corrige una factura de venta (o rectificativa) ya emitida generando una
// factura rectificativa que la referencia — la original nunca se toca ni
// se borra, así se conserva la numeración correlativa. El importe
// original lo lee el servidor de public.invoices, no se reintroduce aquí.
export default function RectificarFacturaButton({
  documentId,
  facturaLabel,
  importeActual,
}: {
  documentId: string
  facturaLabel: string
  importeActual?: number
}) {
  const [open, setOpen] = useState(false)
  const [precioNuevo, setPrecioNuevo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerar() {
    const nuevo = Number(precioNuevo)
    if (!nuevo || nuevo < 0) {
      setError('Introduce el importe correcto.')
      return
    }
    if (!motivo.trim()) {
      setError('Indica el motivo de la rectificación.')
      return
    }
    setGenerando(true)
    setError(null)
    try {
      const res = await fetch(`/api/facturas/${documentId}/rectificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ precio_nuevo: nuevo, motivo: motivo.trim() }),
      })
      if (!res.ok) {
        const resBody = await res.json().catch(() => null)
        setError(resBody?.error ?? 'No se ha podido generar la factura rectificativa.')
        return
      }
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="(.+)"/)
      const filename = match?.[1] ?? 'factura-rectificativa.pdf'
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setOpen(false)
    } catch {
      setError('No se ha podido generar la factura rectificativa. Inténtalo de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <>
      <button type="button" className="secondary-btn" onClick={() => setOpen(true)}>
        Rectificar
      </button>

      {open && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>Rectificar factura</h2>
            <p className="form-note">
              Factura original: {facturaLabel}
              {importeActual !== undefined
                ? ` · ${importeActual.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
                : ''}
            </p>

            <div className="form-field" style={{ marginTop: 10 }}>
              <label htmlFor="precio_nuevo">Importe correcto (€)</label>
              <input
                id="precio_nuevo"
                type="number"
                step="0.01"
                value={precioNuevo}
                onChange={(e) => setPrecioNuevo(e.target.value)}
              />
            </div>
            <div className="form-field" style={{ marginTop: 10 }}>
              <label htmlFor="motivo">Motivo de la rectificación</label>
              <textarea id="motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <p className="form-note">
              Se emite una nueva factura rectificativa con su propio número correlativo — la factura original no se
              modifica ni se borra.
            </p>

            {error && <p className="login-error">{error}</p>}

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setOpen(false)}>
                Cerrar
              </button>
              <button type="button" className="primary-btn" onClick={handleGenerar} disabled={generando}>
                {generando ? 'Generando…' : 'Generar rectificativa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
