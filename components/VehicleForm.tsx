const ESTADOS = [
  { value: 'entrada', label: 'Entrada / compra' },
  { value: 'preparacion', label: 'En preparación' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'reservado', label: 'Reservado' },
  { value: 'vendido', label: 'Vendido' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'posventa', label: 'Posventa' },
]

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
  return (
    <form action={action} className="vehicle-form">
      <section className="form-section">
        <h2>Identificación</h2>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="company_id">Empresa *</label>
            <select
              id="company_id"
              name="company_id"
              defaultValue={vehicle?.company_id ?? defaultCompanyId}
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
            <input id="marca" name="marca" defaultValue={vehicle?.marca} required />
          </div>

          <div className="form-field">
            <label htmlFor="modelo">Modelo *</label>
            <input id="modelo" name="modelo" defaultValue={vehicle?.modelo} required />
          </div>

          <div className="form-field">
            <label htmlFor="vin">Bastidor / VIN</label>
            <input id="vin" name="vin" defaultValue={vehicle?.vin ?? ''} />
          </div>

          <div className="form-field">
            <label htmlFor="matricula">Matrícula</label>
            <input id="matricula" name="matricula" defaultValue={vehicle?.matricula ?? ''} />
          </div>

          <div className="form-field">
            <label htmlFor="estado">Estado</label>
            <select id="estado" name="estado" defaultValue={vehicle?.estado ?? 'entrada'}>
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>Datos técnicos</h2>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="anio">Año</label>
            <input id="anio" name="anio" type="number" defaultValue={vehicle?.anio ?? ''} />
          </div>
          <div className="form-field">
            <label htmlFor="km">Kilómetros</label>
            <input id="km" name="km" type="number" defaultValue={vehicle?.km ?? ''} />
          </div>
          <div className="form-field">
            <label htmlFor="combustible">Combustible</label>
            <input id="combustible" name="combustible" defaultValue={vehicle?.combustible ?? ''} />
          </div>
          <div className="form-field">
            <label htmlFor="transmision">Transmisión</label>
            <input id="transmision" name="transmision" defaultValue={vehicle?.transmision ?? ''} />
          </div>
          <div className="form-field">
            <label htmlFor="color">Color</label>
            <input id="color" name="color" defaultValue={vehicle?.color ?? ''} />
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
              defaultValue={vehicle?.precio_compra ?? ''}
            />
          </div>
          <div className="form-field">
            <label htmlFor="precio_venta_previsto">Precio venta previsto (€)</label>
            <input
              id="precio_venta_previsto"
              name="precio_venta_previsto"
              type="number"
              step="0.01"
              defaultValue={vehicle?.precio_venta_previsto ?? ''}
            />
          </div>
          <div className="form-field">
            <label htmlFor="precio_venta_real">Precio venta real (€)</label>
            <input
              id="precio_venta_real"
              name="precio_venta_real"
              type="number"
              step="0.01"
              defaultValue={vehicle?.precio_venta_real ?? ''}
            />
          </div>
          <div className="form-field">
            <label htmlFor="fecha_venta">Fecha de venta</label>
            <input id="fecha_venta" name="fecha_venta" type="date" defaultValue={vehicle?.fecha_venta ?? ''} />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>Notas</h2>
        <textarea name="notas" rows={4} defaultValue={vehicle?.notas ?? ''} />
      </section>

      <button type="submit" className="primary-btn">
        {vehicle ? 'Guardar cambios' : 'Dar de alta el vehículo'}
      </button>
    </form>
  )
}
