import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage } from 'pdf-lib'

// Misma técnica que facturaVentaPdf.ts/contractPdf.ts (pdf-lib, sin React).
// El objetivo es que, impreso a escala 100% (sin "ajustar a página"), cada
// recuadro salga exactamente al tamaño real de una tarjeta ISO/IEC 7810
// ID-1 (85,60 × 53,98 mm) — el formato físico del DNI — para poder
// recortar y enviar a Tráfico.

const PAGE_WIDTH = 595.28 // A4 en puntos
const PAGE_HEIGHT = 841.89
const MARGIN = 40

const MM_TO_PT = 2.834645669
const CARD_WIDTH = 85.6 * MM_TO_PT
const CARD_HEIGHT = 53.98 * MM_TO_PT

const GRAPHITE = rgb(0x14 / 255, 0x18 / 255, 0x1d / 255)
const GRAY = rgb(0x4a / 255, 0x55 / 255, 0x68 / 255)

export async function buildDniPdf(args: {
  clienteNombre: string
  anversoBytes: Buffer
  anversoMime: string | null
  reversoBytes: Buffer
  reversoMime: string | null
}): Promise<Buffer> {
  const { clienteNombre, anversoBytes, anversoMime, reversoBytes, reversoMime } = args

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y = PAGE_HEIGHT - MARGIN

  function text(
    value: string,
    { size = 10, bold = false, color = GRAPHITE, gap = 0 }: { size?: number; bold?: boolean; color?: any; gap?: number } = {}
  ) {
    page.drawText(value, { x: MARGIN, y, size, font: bold ? fontBold : font, color })
    y -= size * 1.4 + gap
  }

  async function embed(bytes: Buffer, mime: string | null): Promise<PDFImage> {
    if (mime?.includes('png')) return pdfDoc.embedPng(bytes)
    return pdfDoc.embedJpg(bytes)
  }

  function drawCard(image: PDFImage, label: string) {
    const boxX = (PAGE_WIDTH - CARD_WIDTH) / 2
    const boxY = y - CARD_HEIGHT

    const scale = Math.min(CARD_WIDTH / image.width, CARD_HEIGHT / image.height)
    const drawWidth = image.width * scale
    const drawHeight = image.height * scale
    page.drawImage(image, {
      x: boxX + (CARD_WIDTH - drawWidth) / 2,
      y: boxY + (CARD_HEIGHT - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    })
    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderColor: GRAY,
      borderWidth: 1,
      borderDashArray: [4, 3],
    })

    const labelWidth = font.widthOfTextAtSize(label, 9)
    page.drawText(label, { x: boxX + (CARD_WIDTH - labelWidth) / 2, y: boxY - 14, size: 9, font, color: GRAY })

    y = boxY - 34
  }

  text('DNI / NIF — tamaño real', { size: 16, bold: true, gap: 2 })
  text(clienteNombre, { size: 11, color: GRAY, gap: 10 })
  text(
    `Cada recuadro mide ${CARD_WIDTH.toFixed(1)} × ${CARD_HEIGHT.toFixed(1)} pt (85,6 × 54 mm, tamaño real de una tarjeta ID-1).`,
    { size: 8, color: GRAY }
  )
  text('Imprimir a escala 100% — sin "ajustar a página" — para que salga a tamaño real.', {
    size: 8,
    color: GRAY,
    gap: 20,
  })

  const anversoImage = await embed(anversoBytes, anversoMime)
  drawCard(anversoImage, 'ANVERSO')

  const reversoImage = await embed(reversoBytes, reversoMime)
  drawCard(reversoImage, 'REVERSO')

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
