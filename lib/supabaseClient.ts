import { createBrowserClient } from '@supabase/ssr'

// Cliente de Supabase para componentes de cliente (navegador).
// Las claves salen de variables de entorno: nunca hardcodear.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
