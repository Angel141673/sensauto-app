import './globals.css'

export const metadata = {
  title: 'SENSAUTO · Panel interno',
  description: 'Gestión interna de vehículos, clientes y documentación — SENSAUTO Motor y SUNAUTO',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#14181d',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
