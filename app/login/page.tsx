'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError('No hemos podido iniciar sesión. Revisa el correo y la contraseña.')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('No hemos podido conectar con el servidor. Inténtalo de nuevo en unos minutos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-screen">
      <div className="login-card">
        <img src="/logo-sensauto.png" alt="SENSAUTO Motor" className="login-logo" />
        <h1>Acceso interno</h1>
        <p className="login-subtitle">SENSAUTO Motor · SUNAUTO</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
