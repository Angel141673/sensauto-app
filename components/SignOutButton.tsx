'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button className="signout-btn" onClick={handleSignOut}>
      Cerrar sesión
    </button>
  )
}
