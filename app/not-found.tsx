import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="login-screen">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h1>Página no encontrada</h1>
        <p className="login-subtitle">Lo que buscas no existe o no tienes acceso a ello.</p>
        <Link href="/dashboard" className="primary-btn" style={{ marginTop: 16 }}>
          Volver al panel
        </Link>
      </div>
    </div>
  )
}
