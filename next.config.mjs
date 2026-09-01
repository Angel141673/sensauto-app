/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Las fotos se comprimen en el navegador antes de subirlas, pero esto
    // da margen extra (PDFs no se comprimen, y por si la compresión falla).
    // Next.js limita las Server Actions a 1 MB por defecto.
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
}

export default nextConfig
