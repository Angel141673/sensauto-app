'use client'

import { useState } from 'react'
import {
  analyzeVehiclePurchaseWithAI,
  type AnalyzeVehicleState,
} from '@/app/dashboard/vehiculos/actions'
import type { VehiclePurchaseAnalysis } from '@/lib/anthropicInvoice'
import { compressImage } from '@/lib/compressImage'

const ESTADOS = [
  { value: 'entrada', label: 'Entrada / compra' },
  { value: 'preparacion', label: 'En preparación' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'reservado', label: 'Reservado' },
  { value: 'vendido', label: 'Vendido' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'posventa', label: 'Posventa' },
]

const CONFIANZA_LABEL: Record<string, string> = {
  alta: 'Confianza alta',
  media: 'Confianza media — revisa antes de guardar',
  baja: 'Confianza baja — revisa con cuidado antes de guardar',
}

const analyzeInitialState: AnalyzeVehicleState = { status: 'idle' }

type Company = { id: string; code: string; name: string }

export default function VehicleForm({
  action,
  companies,
  defaultCompanyId,
  vehicle,
}: {
  action: (formData: FormData) => void
  companies: Company[]
  defaultCompanyId?: string
  vehicle?: any
}) {
  const isEdit = !!vehicle

  const [companyId, setCompanyId] = useState(vehicle?.company_id ?? defaultCompanyId ?? '')
  const [marca, setMarca] = useState(vehicle?.marca ?? '')
  const [modelo, setModelo] = useState(vehicle?.modelo ?? '')
  const [vin, setVin] = useState(vehicle?.vin ?? '')
  const [matricula, setMatricula] = useState(vehicle?.matricula ?? '')
  const [estado, setEstado] = useState(vehicle?.estado ?? 'entrada')
  const [numeroLlave, setNumeroLlave] = useState(vehicle?.numero_llave ?? '')
  const [anio, setAnio] = useState(vehicle?.anio ?? '')
  const [km, setKm] = useState(vehicle?.km ?? '')
  const [combustible, setCombustible] = useState(vehicle?.combustible ?? '')
  const [transmision, setTransmision] = useState(vehicle?.transmision ?? '')
  const [color, setColor] = useState(vehicle?.color ?? '')
  const [motor, setMotor] = useState(vehicle?.motor ?? '')
  const [fechaMatriculacion, setFechaMatriculacion] = useState(vehicle?.fecha_matriculacion ?? '')
  const [precioCompra, setPrecioCompra] = useState(vehicle?.precio_compra ?? '')
  const [precioVentaPrevisto, setPrecioVentaPrevisto] = useState(vehicle?.precio_venta_previsto ?? '')
  const [precioVentaReal, setPrecioVentaReal] = useState(vehicle?.precio_venta_real ?? '')
  const [fechaVenta, setFechaVenta] = useState(vehicle?.fecha_venta ?? '')
  const [notas, setNotas] = useState(vehicle?.notas ?? '')

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<VehiclePurchaseAnalysis | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const vinDetectadoInvalido = !!analysis?.vin && analysis.vin.length !== 17

  async function handleAnalizar() {
    if (!selectedFile) {
      setAnalyzeError('Selecciona primero una foto de la factura de compra.')
      return
    }
    setAnalyzing(true)
    setAnalyzeError(null)
    setAnalysis(null)

    try {
      // Las fotos de cámara de móvil pesan varios MB — se comprimen antes
      // de enviarlas, para no chocar con el límite de tamaño de las Server
      // Actions (la subida se quedaría colgada sin avisar).
      const comprimido = await compressImage(selectedFile)
      const formData = new FormData()
      formData.set('file', comprimido)

      const result = await analyzeVehiclePurchaseWithAI(analyzeInitialState, formData)

      if (result.status === 'error') {
        setAnalyzeError(result.message ?? 'No se ha podido analizar la factura.')
        return
      }

      if (result.analysis) {
        setAnalysis(result.analysis)
      }
    } catch {
      setAnalyzeError('No se ha podido analizar la factura. Inténtalo de nuevo.')
    } finally {
      setAnalyzing(false)
    }
  }

  function aplicarSugerencias() {
    if (!analysis) return
    if (analysis.marca) setMarca(analysis.marca)
    if (analysis.modelo) setModelo(analysis.modelo)
    // El VIN solo se aplica si tiene exactamente 17 caracteres — si no,
    // se deja vacío/como estaba para que se revise y escriba a mano.
    if (analysis.vin && analysis.vin.length === 17) setVin(analysis.vin)
    if (analysis.matricula) setMatricula(analysis.matricula)
    if (analysis.km !== null) setKm(String(analysis.km))
    if (analysis.color) setColor(analysis.color)
    if (analysis.motor) setMotor(analysis.motor)
    if (analysis.precio_compra !== null) setPrecioCompra(String(analysis.precio_compra))
    if (analysis.fecha_matriculacion) {
      setFechaMatriculacion(analysis.fecha_matriculacion)
      if (!anio) setAnio(analysis.fecha_matriculacion.slice(0, 4))
    }
  }

  return (
    <form action={action} className="vehicle-form">
      {!isEdit && (
        <section className="form-section">
          <h2>Analizar factura de compra con IA</h2>
          <p className="form-note">
            Sube la foto de la factura de compra del vehículo y pulsa "Analizar con IA" (Claude,
            coste aproximado inferior a un céntimo por factura). La IA propone los datos; tú decides
            si los usas antes de guardar.
          </p>
          <div className="form-field">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <button
            type="button"
            className="secondary-btn"
            style={{ marginTop: 10 }}
            onClick={handleAnalizar}
            disabled={analyzing || !selectedFile}
          >
            {analyzing ? 'Analizando…' : 'Analizar con IA'}
          </button>

          {analyzeError && <p className="login-error" style={{ marginTop: 10 }}>{analyzeError}</p>}

          {analysis && (
            <div className="ocr-suggestion" style={{ marginTop: 12 }}>
              <p><strong>{CONFIANZA_LABEL[analysis.confianza_total]}</strong></p>
              <p>
                Marca: {analysis.marca ?? '—'} · Modelo: {analysis.modelo ?? '—'} · Motor:{' '}
                {analysis.motor ?? '—'} · Color: {analysis.color ?? '—'}
                <br />
                Fecha de matriculación: {analysis.fecha_matriculacion ?? '—'} · Km: {analysis.km ?? '—'}{' '}
                · Precio de compra: {analysis.precio_compra ?? '—'} € · Matrícula:{' '}
                {analysis.matricula ?? '—'}
                <br />
                VIN detectado: {analysis.vin ?? '—'}
                {analysis.vin && ` (${analysis.vin.length} caracteres)`}
              </p>
              {vinDetectadoInvalido && (
                <p className="login-error">
                  El VIN detectado tiene {analysis.vin!.length} caracteres, debe tener exactamente
                  17 — no se va a rellenar automáticamente. Revísalo contra la factura y escríbelo a
                  mano antes de guardar.
                </p>
              )}
              <button type="button" className="secondary-btn" onClick={aplicarSugerencias}>
                Usar estos datos en el formulario
              </button>
            </div>
          )}
        </section>
      )}

      <section className="form-section">
        <h2>Identificación</h2>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="company_id">Empresa *</label>
            <select
              id="company_id"
              name="company_id"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              required
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="marca">Marca *</label>
            <input id="marca" name="marca" value={marca} onChange={(e) => setMarca(e.target.value)} required />
          </div>

          <div className="form-field">
            <label htmlFor="modelo">Modelo *</label>
            <input id="modelo" name="modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} required />
          </div>

          <div className="form-field">
            <label htmlFor="vin">Bastidor / VIN</label>
            <input id="vin" name="vin" value={vin} onChange={(e) => setVin(e.target.value)} />
          </div>

          <div className="form-field">
            <label htmlFor="matricula">Matrícula</label>
            <input id="matricula" name="matricula" value={matricula} onChange={(e) => setMatricula(e.target.value)} />
          </div>

          <div className="form-field">
            <label htmlFor="estado">Estado</label>
            <select id="estado" name="estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="numero_llave">Número de llave (interno)</label>
            <input
              id="numero_llave"
              name="numero_llave"
              value={numeroLlave}
              onChange={(e) => setNumeroLlave(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>Datos técnicos</h2>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="fecha_matriculacion">Fecha de matriculación</label>
            <input
              id="fecha_matriculacion"
              name="fecha_matriculacion"
              type="date"
              value={fechaMatriculacion}
              onChange={(e) => setFechaMatriculacion(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="anio">Año</label>
            <input id="anio" name="anio" type="number" value={anio} onChange={(e) => setAnio(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="km">Kilómetros</label>
            <input id="km" name="km" type="number" value={km} onChange={(e) => setKm(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="motor">Motor</label>
            <input
              id="motor"
              name="motor"
              placeholder="ej. 2.0 TDI 150 CV"
              value={motor}
              onChange={(e) => setMotor(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="combustible">Combustible</label>
            <input id="combustible" name="combustible" value={combustible} onChange={(e) => setCombustible(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="transmision">Transmisión</label>
            <input id="transmision" name="transmision" value={transmision} onChange={(e) => setTransmision(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="color">Color</label>
            <input id="color" name="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>Económico</h2>
        <p className="form-note">
          La inversión total sumará automáticamente los gastos asociados cuando
          se implemente el módulo de facturas/gastos (Bloque 8). Por ahora
          refleja solo el precio de compra.
        </p>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="precio_compra">Precio de compra (€)</label>
            <input
              id="precio_compra"
              name="precio_compra"
              type="number"
              step="0.01"
              value={precioCompra}
              onChange={(e) => setPrecioCompra(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="precio_venta_previsto">Precio venta previsto (€)</label>
            <input
              id="precio_venta_previsto"
              name="precio_venta_previsto"
              type="number"
              step="0.01"
              value={precioVentaPrevisto}
              onChange={(e) => setPrecioVentaPrevisto(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="precio_venta_real">Precio venta real (€)</label>
            <input
              id="precio_venta_real"
              name="precio_venta_real"
              type="number"
              step="0.01"
              value={precioVentaReal}
              onChange={(e) => setPrecioVentaReal(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="fecha_venta">Fecha de venta</label>
            <input
              id="fecha_venta"
              name="fecha_venta"
              type="date"
              value={fechaVenta}
              onChange={(e) => setFechaVenta(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>Notas</h2>
        <textarea name="notas" rows={4} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </section>

      <button type="submit" className="primary-btn">
        {isEdit ? 'Guardar cambios' : 'Dar de alta el vehículo'}
      </button>
    </form>
  )
}
