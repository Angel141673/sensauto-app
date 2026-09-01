// Convierte una URL firmada de Supabase Storage (ya generada para "Ver",
// sin forzar descarga) en su variante de descarga, añadiendo el parámetro
// "download" a la query string — Supabase lo lee de forma independiente
// al token de firma, así que no hace falta pedir una segunda URL firmada.
export function withDownload(url: string, filename: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}download=${encodeURIComponent(filename)}`
}
