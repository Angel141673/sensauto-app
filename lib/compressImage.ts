// Comprime una foto en el propio navegador antes de subirla — las fotos de
// cámara de móvil suelen pesar varios MB, y las subidas vía Server Action
// tienen un límite de tamaño (1 MB por defecto en Next.js, y Vercel impone
// además su propio límite de plataforma) que se supera fácilmente y deja
// la subida colgada sin avisar. Reducir a un ancho máximo razonable con
// compresión JPEG deja el archivo en unos cientos de KB sin perder
// legibilidad para un documento fotografiado.
export async function compressImage(
  file: File,
  { maxDimension = 1600, quality = 0.82 }: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file
  }

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob || blob.size >= file.size) return file

  const nombre = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], nombre, { type: 'image/jpeg' })
}
