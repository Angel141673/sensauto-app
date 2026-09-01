'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createExpense,
  analyzeInvoiceWithAI,
  findVehicleByVin,
  createVehicleFromVin,
  type ExpenseState,
  type AnalyzeState,
} from './actions'
import type { InvoiceAnalysis } from '@/lib/anthropicInvoice'
import { compressImage } from '@/lib/compressImage'

type Vehicle = { id: string; marca: string; modelo: string; vin: string | null }

const expenseInitialState: ExpenseState = { status: 'idle' }
const analyzeInitialState: AnalyzeState = { status: 'idle' }

const CONFIANZA_LABEL: Record<string, string> = {
  alta: 'Confianza alta',
  media: 'Confianza media — revisa antes de guardar',
  baja: 'Confianza baja — revisa con cuidado antes de guardar',
}

export default function ExpenseForm({
  companyId,
  vehicles,
}: {
  companyId: string
  companyCode: string
  vehicles: Vehicle[]
}) {
  const router = useRouter()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [comprimiendo, setComprimiendo] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<InvoiceAnalysis | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [vehiculoSugerido, setVehiculoSugerido] = useState<Vehicle | null>(null)
  const [vinSinVehiculo, setVinSinVehiculo] = useState<string | null>(null)
  const [creandoVehiculo, setCreandoVehiculo] = useState(false)
  const [crearVehiculoError, setCrearVehiculoError] = useState<string | null>(null)
  const [vehiculoCreado, setVehiculoCreado] = useState<Vehicle | null>(null)

  const [vehicleValue, setVehicleValue] = useState('')
  const [proveedorValue, setProveedorValue] = useState('')
  const [fechaValue, setFechaValue] = useState('')
  const [baseValue, setBaseValue] = useState('')
  const [totalValue, setTotalValue] = useState('')
  const [notasValue, setNotasValue] = useState('')

  const [saveState, setSaveState] = useState<ExpenseState>(expenseInitialState)
  const [saving, setSaving] = useState(false)

  // Las fotos de cámara de móvil pesan varios MB — se comprimen aquí antes
  // de usarlas, para no chocar con el límite de tamaño de las Server
  // Actions (la subida se quedaría colgada sin avisar).
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      return
    }
    setComprimiendo(true)
    try {
      setSelectedFile(await compressImage(file))
    } finally {
      setComprimiendo(false)
    }
  }

  async function handleAnalizar() {
    if (!selectedFile) {
      setAnalyzeError('Selecciona primero una foto de la factura.')
      return
    }
    setAnalyzing(true)
    setAnalyzeError(null)
    setAnalysis(null)
    setVehiculoSugerido(null)
    setVinSinVehiculo(null)
    setCrearVehiculoError(null)
    setVehiculoCreado(null)

    try {
      const formData = new FormData()
      formData.set('file', selectedFile)

      const result = await analyzeInvoiceWithAI(analyzeInitialState, formData)

      if (result.status === 'error') {
        setAnalyzeError(result.message ?? 'No se ha podido analizar la factura.')
        return
      }

      if (result.analysis) {
        setAnalysis(result.analysis)
        if (result.analysis.vin) {
          const vehicle = await findVehicleByVin(companyId, result.analysis.vin)
          if (vehicle) {
            setVehiculoSugerido(vehicle)
          } else {
            setVinSinVehiculo(result.analysis.vin)
          }
        }
      }
    } catch {
      setAnalyzeError('No se ha podido analizar la factura. Inténtalo de nuevo.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleCrearVehiculo() {
    if (!vinSinVehiculo) return
    setCreandoVehiculo(true)
    setCrearVehiculoError(null)

    try {
      const vehicle = await createVehicleFromVin(companyId, vinSinVehiculo)
      setVehiculoCreado(vehicle)
      setVinSinVehiculo(null)
      setVehicleValue(vehicle.id)
      router.refresh()
    } catch (err: any) {
      setCrearVehiculoError(err?.message ?? 'No se ha podido crear el vehículo. Inténtalo de nuevo.')
    } finally {
      setCreandoVehiculo(false)
    }
  }

  function aplicarSugerencias() {
    if (!analysis) return
    if (analysis.proveedor) setProveedorValue(analysis.proveedor)
    if (analysis.fecha) setFechaValue(analysis.fecha)
    if (analysis.base !== null) setBaseValue(String(analysis.base))
    if (analysis.total !== null) setTotalValue(String(analysis.total))
  }

  async function handleGuardar(e: React.FormEvent, confirmarDuplicado?: 'archivo' | 'contenido') {
    e.preventDefault()
    setSaving(true)

    try {
      const formData = new FormData()
      formData.set('company_id', companyId)
      formData.set('vehicle_id', vehicleValue)
      formData.set('proveedor', proveedorValue)
      formData.set('fecha', fechaValue)
      formData.set('base', baseValue)
      formData.set('total', totalValue)
      formData.set('notas', notasValue)
      if (selectedFile) formData.set('file', selectedFile)
      if (confirmarDuplicado === 'archivo') formData.set('confirmar_duplicado_archivo', 'true')
      if (confirmarDuplicado === 'contenido') formData.set('confirmar_duplicado_contenido', 'true')

      const result = await createExpense(expenseInitialState, formData)
      setSaveState(result)

      if (result.status === 'success') {
        router.refresh()
      }
    } catch {
      setSaveState({ status: 'error', message: 'No se ha podido guardar el gasto. Inténtalo de nuevo.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <section className="form-section">
        <h2>Analizar factura con IA</h2>
        <p className="form-note">
          Sube la foto y pulsa "Analizar con IA" (Claude, coste aproximado inferior a un
          céntimo por factura). La IA propone los datos; tú decides si los usas antes de guardar.
        </p>
        <div className="form-field">
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </div>
        <button
          type="button"
          className="secondary-btn"
          style={{ marginTop: 10 }}
          onClick={handleAnalizar}
          disabled={analyzing || comprimiendo || !selectedFile}
        >
          {analyzing ? 'Analizando…' : comprimiendo ? 'Preparando foto…' : 'Analizar con IA'}
        </button>

        {analyzeError && <p className="login-error" style={{ marginTop: 10 }}>{analyzeError}</p>}

        {analysis && (
          <div className="ocr-suggestion" style={{ marginTop: 12 }}>
            <p><strong>{CONFIANZA_LABEL[analysis.confianza_total]}</strong></p>
            <p>
              Proveedor: {analysis.proveedor ?? '—'} · Fecha: {analysis.fecha ?? '—'} · Base:{' '}
              {analysis.base ?? '—'} € · Total: {analysis.total ?? '—'} €
              {analysis.vin && <> · VIN detectado: {analysis.vin}</>}
            </p>
            <button type="button" className="secondary-btn" onClick={aplicarSugerencias}>
              Usar estos datos en el formulario
            </button>
          </div>
        )}

        {vehiculoSugerido && (
          <div className="ocr-suggestion" style={{ marginTop: 12 }}>
            <p>
              Creo que esta factura es del <strong>{vehiculoSugerido.marca} {vehiculoSugerido.modelo}</strong>{' '}
              (bastidor {vehiculoSugerido.vin}). Confirma si quieres vincularla.
            </p>
            <button type="button" className="secondary-btn" onClick={() => setVehicleValue(vehiculoSugerido.id)}>
              Vincular a este vehículo
            </button>
          </div>
        )}

        {vinSinVehiculo && (
          <div className="ocr-suggestion" style={{ marginTop: 12 }}>
            <p>
              No hay ningún vehículo con el bastidor <strong>{vinSinVehiculo}</strong> en esta empresa.
              ¿Quieres crearlo? Marca y modelo quedarán como "Pendiente" hasta que los edites en la
              ficha del vehículo.
            </p>
            <button type="button" className="secondary-btn" onClick={handleCrearVehiculo} disabled={creandoVehiculo}>
              {creandoVehiculo ? 'Creando…' : 'Crear vehículo con este VIN'}
            </button>
            {crearVehiculoError && <p className="login-error" style={{ marginTop: 8 }}>{crearVehiculoError}</p>}
          </div>
        )}

        {vehiculoCreado && (
          <div className="ocr-suggestion" style={{ marginTop: 12 }}>
            <p>
              Vehículo creado y vinculado a este gasto (bastidor {vehiculoCreado.vin}). Recuerda editar
              la marca y el modelo reales desde su ficha.
            </p>
          </div>
        )}
      </section>

      <form onSubmit={(e) => handleGuardar(e)} className="vehicle-form">
        <section className="form-section">
          <h2>Confirmar y guardar gasto</h2>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="vehicle_id">Vehículo (opcional)</label>
              <select id="vehicle_id" value={vehicleValue} onChange={(e) => setVehicleValue(e.target.value)}>
                <option value="">— Sin vincular —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} {v.vin ? `— ${v.vin}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="proveedor">Proveedor</label>
              <input id="proveedor" value={proveedorValue} onChange={(e) => setProveedorValue(e.target.value)} />
            </div>

            <div className="form-field">
              <label htmlFor="fecha">Fecha</label>
              <input id="fecha" type="date" value={fechaValue} onChange={(e) => setFechaValue(e.target.value)} />
            </div>

            <div className="form-field">
              <label htmlFor="base">Base (€)</label>
              <input id="base" type="number" step="0.01" value={baseValue} onChange={(e) => setBaseValue(e.target.value)} />
            </div>

            <div className="form-field">
              <label htmlFor="total">Total (€) *</label>
              <input id="total" type="number" step="0.01" required value={totalValue} onChange={(e) => setTotalValue(e.target.value)} />
            </div>
          </div>

          <div className="form-field" style={{ marginTop: 14 }}>
            <label htmlFor="notas">Notas</label>
            <textarea id="notas" rows={2} value={notasValue} onChange={(e) => setNotasValue(e.target.value)} />
          </div>
        </section>

        {(saveState.status === 'duplicate_file' || saveState.status === 'duplicate_content') && (
          <div className="duplicate-warning">
            <p>{saveState.message}</p>
            <button
              type="button"
              className="secondary-btn"
              onClick={(e) =>
                handleGuardar(e as any, saveState.status === 'duplicate_file' ? 'archivo' : 'contenido')
              }
            >
              Sí, guardar de todas formas
            </button>
          </div>
        )}

        {saveState.status === 'error' && <p className="login-error">{saveState.message}</p>}
        {saveState.status === 'success' && <p className="success-note">{saveState.message}</p>}

        {saveState.status !== 'duplicate_file' && saveState.status !== 'duplicate_content' && (
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar gasto'}
          </button>
        )}
      </form>
    </div>
  )
}
