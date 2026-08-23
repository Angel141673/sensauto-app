import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CompanySwitcher from '@/components/CompanySwitcher'
import SignOutButton from '@/components/SignOutButton'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // El nombre para el saludo sale del perfil del usuario autenticado.
  // No hay "Ángel" ni "Vanessa" escritos en ningún sitio del código.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // Empresas a las que este usuario tiene acceso (join con user_companies).
  const { data: memberships } = await supabase
    .from('user_companies')
    .select('company:companies(id, code, name)')
    .eq('user_id', user.id)

  const companies = (memberships ?? [])
    .map((m: any) => m.company)
    .filter(Boolean)

  const displayName = profile?.full_name ?? user.email ?? 'usuario'

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <img src="/logo-sensauto.png" alt="SENSAUTO Motor" className="dashboard-logo" />
          <CompanySwitcher companies={companies} />
        </div>
        <div className="dashboard-header-right">
          <span className="dashboard-greeting">Hola, {displayName}</span>
          <SignOutButton />
        </div>
      </header>

      <nav className="dashboard-nav">
        <Link href="/dashboard">Inicio</Link>
        <Link href="/dashboard/vehiculos">Vehículos</Link>
        <Link href="/dashboard/clientes">Clientes</Link>
        <Link href="/dashboard/documentos">Documentos</Link>
        <Link href="/dashboard/gastos">Gastos</Link>
        <Link href="/dashboard/informes">Informes</Link>
      </nav>

      <main className="dashboard-main">{children}</main>
    </div>
  )
}
