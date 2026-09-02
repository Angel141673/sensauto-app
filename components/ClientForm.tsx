export default function ClientForm({
  action,
  client,
}: {
  action: (formData: FormData) => void
  client?: any
}) {
  return (
    <form action={action} className="vehicle-form">
      <section className="form-section">
        <h2>Datos del cliente</h2>
        <div className="form-grid">
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
            <label htmlFor="direccion">Calle</label>
            <input id="direccion" name="direccion" defaultValue={client?.direccion ?? ''} />
          </div>

          <div className="form-field">
            <label htmlFor="codigo_postal">Código postal</label>
            <input id="codigo_postal" name="codigo_postal" defaultValue={client?.codigo_postal ?? ''} />
          </div>

          <div className="form-field">
            <label htmlFor="provincia">Provincia</label>
            <input id="provincia" name="provincia" defaultValue={client?.provincia ?? ''} />
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
