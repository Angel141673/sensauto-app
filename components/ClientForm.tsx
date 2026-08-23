type Company = { id: string; code: string; name: string }

export default function ClientForm({
  action,
  companies,
  defaultCompanyId,
  client,
}: {
  action: (formData: FormData) => void
  companies: Company[]
  defaultCompanyId?: string
  client?: any
}) {
  return (
    <form action={action} className="vehicle-form">
      <section className="form-section">
        <h2>Datos del cliente</h2>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="company_id">Empresa *</label>
            <select
              id="company_id"
              name="company_id"
              defaultValue={client?.company_id ?? defaultCompanyId}
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
            <label htmlFor="nombre">Nombre *</label>
            <input id="nombre" name="nombre" defaultValue={client?.nombre} required />
          </div>

          <div className="form-field">
            <label htmlFor="telefono">Teléfono</label>
            <input id="telefono" name="telefono" defaultValue={client?.telefono ?? ''} />
          </div>

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" defaultValue={client?.email ?? ''} />
          </div>

          <div className="form-field">
            <label htmlFor="dni_nif">DNI / NIF</label>
            <input id="dni_nif" name="dni_nif" defaultValue={client?.dni_nif ?? ''} />
          </div>

          <div className="form-field">
            <label htmlFor="direccion">Dirección</label>
            <input id="direccion" name="direccion" defaultValue={client?.direccion ?? ''} />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>Notas</h2>
        <textarea name="notas" rows={4} defaultValue={client?.notas ?? ''} />
      </section>

      <button type="submit" className="primary-btn">
        {client ? 'Guardar cambios' : 'Dar de alta el cliente'}
      </button>
    </form>
  )
}
