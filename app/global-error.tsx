'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body>
        <div className="login-screen">
          <div className="login-card" style={{ textAlign: 'center' }}>
            <h1>Algo ha ido mal</h1>
            <p className="login-subtitle">
              No se ha podido completar la acción. Puedes intentarlo de nuevo.
            </p>
            <button className="primary-btn" onClick={() => reset()} style={{ marginTop: 16 }}>
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
