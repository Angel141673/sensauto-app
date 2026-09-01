'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

// Lee la empresa activa (?empresa=SENSAUTO|SUNAUTO) y la refleja como
// data-company en <html>, que globals.css usa para recolorear el acento
// de marca (cabecera, nav, botones, pill activo) — así se nota a golpe
// de vista en qué empresa se está trabajando. No renderiza nada.
export default function CompanyThemeWatcher() {
  const searchParams = useSearchParams()
  const empresa = searchParams.get('empresa')

  useEffect(() => {
    if (empresa === 'SENSAUTO' || empresa === 'SUNAUTO') {
      document.documentElement.setAttribute('data-company', empresa)
    } else {
      document.documentElement.removeAttribute('data-company')
    }
  }, [empresa])

  return null
}
