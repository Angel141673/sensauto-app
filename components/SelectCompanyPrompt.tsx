import Link from 'next/link'

type Company = { code: string; name: string }

// Se muestra cuando la página necesita una empresa activa (SENSAUTO/SUNAUTO)
// pero la URL no trae ?empresa=, para no asumir nunca una empresa por defecto.
export default function SelectCompanyPrompt({
  companies,
  basePath,
  showTodas = false,
}: {
  companies: Company[]
  basePath: string
  showTodas?: boolean
}) {
  return (
    <div className="empty-state">
      <p>Elige primero una empresa para continuar:</p>
      <div className="company-switcher" role="group" aria-label="Selector de empresa">
        {companies.map((c) => (
          <Link key={c.code} href={`${basePath}?empresa=${c.code}`} className="company-pill">
            {c.code}
          </Link>
        ))}
        {showTodas && companies.length > 1 && (
          <Link href={`${basePath}?empresa=TODAS`} className="company-pill">
            Resumen conjunto
          </Link>
        )}
      </div>
    </div>
  )
}
