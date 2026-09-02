'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { createQuickClient, type QuickClientState } from '@/app/dashboard/vehiculos/[id]/presupuesto/actions'

type Client = { id: string; nombre: string }

const quickClientInitialState: QuickClientState = { status: 'idle' }

export default function GenerateProformaModal({
  vehicleId,
  vehiculoLabel,
  clients,
  precioSugerido,
  onClose,
}: {
  vehicleId: string
  vehiculoLabel: string
  clients: Client[]
  precioSugerido: number | null
  onClose: () => void
}) {
  const [clientesDisponibles, setClientesDisponibles] = useState(clients)
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [precio, setPrecio] = useState(precioSugerido ? String(precioSugerido) : '')
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(clients.length === 0)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [quickClientState, quickClientAction] = useFormState(createQuickClient, quickClientInitialState)

  if (quickClientState.status === 'idle' && quickClientState.client) {
    const nuevo = quickClientState.client
    if (!clientesDisponibles.some((c) => c.id === nuevo.id)) {
      setClientesDisponibles((prev) => [...prev, nuevo])
      setClientId(nuevo.id)
      setMostrarNuevoCliente(false)
    }
  }

  async function handleGenerar() {
    if (!clientId) {
      setError('Selecciona o crea primero un cliente.')
      return
    }
    const precioNum = Number(precio)
    if (!precioNum || precioNum <= 0) {
      setError('Introduce un precio válido.')
      return
    }
    setGenerando(true)
    setError(null)
    try {
      const res = await fetch(`/api/vehiculos/${vehicleId}/presupuesto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, precio: precioNum }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? 'No se ha podido generar el presupuesto.')
        return
      }
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="(.+)"/)
      const filename = match?.[1] ?? 'presupuesto.pdf'
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      onClose()
    } catch {
      setError('No se ha podido generar el presupuesto. Inténtalo de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Generar presupuesto</h2>
        <p className="form-note">Vehículo: {vehiculoLabel}</p>

        <div className="form-field">
          <label htmlFor="client_id">Cliente</label>
          {clientesDisponibles.length > 0 && !mostrarNuevoCliente ? (
            <select id="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clientesDisponibles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            className="secondary-btn"
            style={{ marginTop: 8 }}
            onClick={() => setMostrarNuevoCliente((v) => !v)}
          >
            {mostrarNuevoCliente ? 'Elegir cliente existente' : '+ Cliente nuevo'}
          </button>
        </div>

        {mostrarNuevoCliente && (
          <form action={quickClientAction} className="form-grid" style={{ marginTop: 10 }}>
            <div className="form-field">
              <label htmlFor="nombre">Nombre *</label>
              <input id="nombre" name="nombre" required />
            </div>
            <div className="form-field">
              <label htmlFor="telefono">Teléfono</label>
              <input id="telefono" name="telefono" />
            </div>
            <div className="form-field">
              <label htmlFor="dni_nif">DNI / NIF</label>
              <input id="dni_nif" name="dni_nif" />
            </div>
            <div className="form-field">
              <label htmlFor="direccion">Calle</label>
              <input id="direccion" name="direccion" />
            </div>
            <div className="form-field">
              <label htmlFor="codigo_postal">Código postal</label>
              <input id="codigo_postal" name="codigo_postal" />
            </div>
            <div className="form-field">
              <label htmlFor="provincia">Provincia</label>
              <input id="provincia" name="provincia" />
            </div>
            {quickClientState.status === 'error' && (
              <p className="login-error">{quickClientState.message}</p>
            )}
            <button type="submit" className="secondary-btn">
              Guardar cliente
            </button>
          </form>
        )}

        <div className="form-field" style={{ marginTop: 14 }}>
          <label htmlFor="precio">Precio ofertado (€)</label>
          <input
            id="precio"
            type="number"
            step="0.01"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
        </div>

        {error && <p className="login-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="primary-btn" onClick={handleGenerar} disabled={generando}>
            {generando ? 'Generando…' : 'Descargar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
