'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { createQuickClient, type QuickClientState } from '@/app/dashboard/clientes/actions'

type Client = { id: string; nombre: string }

const quickClientInitialState: QuickClientState = { status: 'idle' }

export default function GenerateContractModal({
  vehicleId,
  vehiculoLabel,
  clients,
  precioSugerido,
  facturaImporte,
  onClose,
}: {
  vehicleId: string
  vehiculoLabel: string
  clients: Client[]
  precioSugerido: number | null
  facturaImporte: number | null
  onClose: () => void
}) {
  const [tipoContrato, setTipoContrato] = useState<'reserva' | 'compraventa'>('reserva')
  const [clientesDisponibles, setClientesDisponibles] = useState(clients)
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(clients.length === 0)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reserva
  const [precioTotal, setPrecioTotal] = useState(precioSugerido ? String(precioSugerido) : '')
  const [senal, setSenal] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [plazoDias, setPlazoDias] = useState('15')
  const [condicionadaFinanciacion, setCondicionadaFinanciacion] = useState(false)

  // Compraventa — el precio no se reintroduce aquí: es el mismo importe ya
  // fijado en la factura de venta (obligatoria antes de poder generar este
  // contrato), así reserva, factura y compraventa muestran siempre la
  // misma cifra.
  const [entregaACuenta, setEntregaACuenta] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [formaPagoVenta, setFormaPagoVenta] = useState('')
  const [garantiaAmpliada, setGarantiaAmpliada] = useState(false)
  const [garantiaImporte, setGarantiaImporte] = useState('520')
  const [elementos, setElementos] = useState({ llaves: true, chaleco: true, kit: true, documentacion: true })

  const [observaciones, setObservaciones] = useState('')

  const [quickClientState, quickClientAction] = useFormState(createQuickClient, quickClientInitialState)

  if (quickClientState.status === 'idle' && quickClientState.client) {
    const nuevo = quickClientState.client
    if (!clientesDisponibles.some((c) => c.id === nuevo.id)) {
      setClientesDisponibles((prev) => [...prev, nuevo])
      setClientId(nuevo.id)
      setMostrarNuevoCliente(false)
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function handleGenerar() {
    if (!clientId) {
      setError('Selecciona o crea primero un cliente.')
      return
    }

    let body: Record<string, unknown>
    if (tipoContrato === 'reserva') {
      const precioTotalNum = Number(precioTotal)
      const senalNum = Number(senal)
      if (!precioTotalNum || precioTotalNum <= 0) {
        setError('Introduce el precio total pactado.')
        return
      }
      if (!senalNum || senalNum < 0) {
        setError('Introduce el importe de la señal.')
        return
      }
      body = {
        client_id: clientId,
        tipo_contrato: 'reserva',
        precio_total: precioTotalNum,
        senal: senalNum,
        fecha_limite: fechaLimite || null,
        plazo_dias: Number(plazoDias) || 15,
        condicionada_financiacion: condicionadaFinanciacion,
        observaciones: observaciones || null,
      }
    } else {
      if (!facturaImporte) {
        setError('Genera primero la factura de venta de esta operación — el contrato de compraventa toma su precio de ahí.')
        return
      }
      body = {
        client_id: clientId,
        tipo_contrato: 'compraventa',
        entrega_a_cuenta: entregaACuenta ? Number(entregaACuenta) : null,
        fecha_entrega: fechaEntrega || null,
        forma_pago: formaPagoVenta || null,
        garantia_ampliada: garantiaAmpliada,
        garantia_importe: garantiaAmpliada ? Number(garantiaImporte) || null : null,
        elementos,
        observaciones: observaciones || null,
      }
    }

    setGenerando(true)
    setError(null)
    try {
      const res = await fetch(`/api/vehiculos/${vehicleId}/contrato`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const resBody = await res.json().catch(() => null)
        setError(resBody?.error ?? 'No se ha podido generar el contrato.')
        return
      }
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="(.+)"/)
      downloadBlob(await res.blob(), match?.[1] ?? 'contrato.pdf')

      onClose()
    } catch {
      setError('No se ha podido generar el contrato. Inténtalo de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>Generar contrato</h2>
        <p className="form-note">Vehículo: {vehiculoLabel}</p>

        <div className="form-field">
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

        <div className="form-field" style={{ marginTop: 10 }}>
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

        {tipoContrato === 'reserva' ? (
          <div className="form-grid" style={{ marginTop: 14 }}>
            <div className="form-field">
              <label htmlFor="precio_total">Precio total pactado (€)</label>
              <input
                id="precio_total"
                type="number"
                step="0.01"
                value={precioTotal}
                onChange={(e) => setPrecioTotal(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="senal">Importe de la señal (€)</label>
              <input id="senal" type="number" step="0.01" value={senal} onChange={(e) => setSenal(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="plazo_dias">Plazo de reserva (días naturales)</label>
              <input
                id="plazo_dias"
                type="number"
                value={plazoDias}
                onChange={(e) => setPlazoDias(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="fecha_limite">Fecha límite para formalizar la compraventa</label>
              <input
                id="fecha_limite"
                type="date"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
              />
            </div>
            <label className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={condicionadaFinanciacion}
                onChange={(e) => setCondicionadaFinanciacion(e.target.checked)}
              />
              Operación condicionada a financiación
            </label>
          </div>
        ) : (
          <div className="form-grid" style={{ marginTop: 14 }}>
            <div className="form-field">
              <label>Precio final pactado (€)</label>
              {facturaImporte ? (
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {facturaImporte.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </p>
              ) : (
                <p className="login-error" style={{ margin: 0 }}>
                  Falta generar la factura de venta de esta operación.
                </p>
              )}
              <p className="form-note">Es el mismo importe de la factura de venta — no se puede cambiar aquí.</p>
            </div>
            <div className="form-field">
              <label htmlFor="entrega_a_cuenta">Entrega a cuenta / reserva (€)</label>
              <input
                id="entrega_a_cuenta"
                type="number"
                step="0.01"
                value={entregaACuenta}
                onChange={(e) => setEntregaACuenta(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="fecha_entrega">Fecha de entrega</label>
              <input
                id="fecha_entrega"
                type="date"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="forma_pago_venta">Forma de pago</label>
              <input
                id="forma_pago_venta"
                value={formaPagoVenta}
                onChange={(e) => setFormaPagoVenta(e.target.value)}
                placeholder="Efectivo, transferencia, financiación..."
              />
            </div>

            <label className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={garantiaAmpliada}
                onChange={(e) => setGarantiaAmpliada(e.target.checked)}
              />
              Contrata garantía comercial ampliada
            </label>
            {garantiaAmpliada && (
              <div className="form-field">
                <label htmlFor="garantia_importe">Importe de la garantía (€)</label>
                <input
                  id="garantia_importe"
                  type="number"
                  step="0.01"
                  value={garantiaImporte}
                  onChange={(e) => setGarantiaImporte(e.target.value)}
                />
              </div>
            )}

            <div className="form-field">
              <label>Elementos entregados</label>
              {(
                [
                  ['llaves', 'Dos llaves'],
                  ['chaleco', 'Chaleco reflectante'],
                  ['kit', 'Kit reparapinchazos'],
                  ['documentacion', 'Documentación provisional'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={elementos[key]}
                    onChange={(e) => setElementos((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-field" style={{ marginTop: 14 }}>
          <label htmlFor="observaciones">Observaciones / condiciones particulares</label>
          <textarea
            id="observaciones"
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
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
