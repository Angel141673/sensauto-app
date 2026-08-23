'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type Company = { id: string; code: string; name: string }

// Cambia la empresa activa vía parámetro ?empresa=CODE en la URL.
// Todas las consultas de datos (vehículos, clientes, facturas...)
// deben filtrar por esta empresa activa + user_has_company_access.
// "Todas" activa el resumen conjunto opcional (solo lectura agregada).
export default function CompanySwitcher({ companies }: { companies: Company[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const active = searchParams.get('empresa') ?? companies[0]?.code ?? ''

  function handleChange(code: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('empresa', code)
    router.push(`/dashboard?${params.toString()}`)
  }

  if (companies.length === 0) {
    return <span className="company-switcher-empty">Sin empresas asignadas</span>
  }

  return (
    <div className="company-switcher" role="group" aria-label="Selector de empresa">
      {companies.map((c) => (
        <button
          key={c.id}
          className={active === c.code ? 'company-pill active' : 'company-pill'}
          onClick={() => handleChange(c.code)}
        >
          {c.code}
        </button>
      ))}
      {companies.length > 1 && (
        <button
          className={active === 'TODAS' ? 'company-pill active' : 'company-pill'}
          onClick={() => handleChange('TODAS')}
        >
          Resumen conjunto
        </button>
      )}
    </div>
  )
}
