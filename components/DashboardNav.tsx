'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ICONS: Record<string, React.ReactNode> = {
  inicio: (
    <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V21h3.5a1 1 0 0 0 1-1V9.5" />
  ),
  vehiculos: (
    <>
      <path d="M4 16V12l1.8-4.2A2 2 0 0 1 7.65 6.5h8.7a2 2 0 0 1 1.85 1.3L20 12v4" />
      <rect x="3" y="16" width="18" height="4" rx="1.2" />
      <circle cx="7.5" cy="20" r="1.3" />
      <circle cx="16.5" cy="20" r="1.3" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 6.5a3 3 0 0 1 0 5.9M20.5 20c0-2.7-2-5-4.7-5.7" />
    </>
  ),
  documentos: (
    <>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4M9 12h6M9 15.5h6M9 8.5h2" />
    </>
  ),
  gastos: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M14.8 9.8c0-1.3-1.25-2.1-2.8-2.1s-2.7.75-2.7 1.9c0 3 5.5 1.4 5.5 4.3 0 1.2-1.2 1.9-2.8 1.9s-2.9-.8-2.9-2.1" />
    </>
  ),
  facturas: (
    <>
      <path d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M15 3v3h3M8 9h8M8 12.5h8M8 16h5" />
    </>
  ),
  informes: (
    <>
      <path d="M4 20V4M4 20h16" />
      <rect x="7" y="13" width="2.6" height="5" rx="0.5" />
      <rect x="11.7" y="9" width="2.6" height="9" rx="0.5" />
      <rect x="16.4" y="6" width="2.6" height="12" rx="0.5" />
    </>
  ),
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: 'inicio' },
  { href: '/dashboard/vehiculos', label: 'Vehículos', icon: 'vehiculos' },
  { href: '/dashboard/clientes', label: 'Clientes', icon: 'clientes' },
  { href: '/dashboard/documentos', label: 'Documentos', icon: 'documentos' },
  { href: '/dashboard/facturas', label: 'Facturas', icon: 'facturas' },
  { href: '/dashboard/gastos', label: 'Gastos', icon: 'gastos' },
  { href: '/dashboard/informes', label: 'Informes', icon: 'informes' },
]

export default function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="dashboard-nav">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? 'dashboard-nav-link active' : 'dashboard-nav-link'}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[item.icon]}
            </svg>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
