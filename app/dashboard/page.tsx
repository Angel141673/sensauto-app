const BLOQUES = [
  { nombre: 'Persistencia / base de datos real', estado: 'IMPLEMENTADO' },
  { nombre: 'Autenticación y usuarios', estado: 'IMPLEMENTADO' },
  { nombre: 'Separación SENSAUTO / SUNAUTO (esquema + RLS)', estado: 'IMPLEMENTADO' },
  { nombre: 'CRUD completo de vehículos', estado: 'IMPLEMENTADO' },
  { nombre: 'Buscador marca / modelo / VIN', estado: 'IMPLEMENTADO' },
  { nombre: 'Clientes y vinculación con vehículos', estado: 'IMPLEMENTADO' },
  { nombre: 'Documentos', estado: 'IMPLEMENTADO' },
  { nombre: 'Facturas / gastos + OCR + duplicados', estado: 'IMPLEMENTADO' },
  { nombre: 'Contratos y firma en tablet', estado: 'IMPLEMENTADO' },
  { nombre: 'WhatsApp', estado: 'IMPLEMENTADO' },
  { nombre: 'Cuadros de inversión / margen / previsión', estado: 'IMPLEMENTADO' },
  { nombre: 'Pulido, seguridad, copias y despliegue', estado: 'PARCIAL' },
]

export default function DashboardHome() {
  return (
    <div className="status-page">
      <h1>Panel interno</h1>
      <p className="status-intro">
        Estado real del proyecto por bloques funcionales. Se actualiza según se completa cada bloque.
      </p>

      <ul className="status-list">
        {BLOQUES.map((b) => (
          <li key={b.nombre} className="status-item">
            <span className={`status-badge status-${b.estado.toLowerCase()}`}>
              {b.estado}
            </span>
            <span>{b.nombre}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
