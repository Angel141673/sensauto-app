import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib'

// Misma técnica que facturaVentaPdf.ts (pdf-lib, sin React).

const PAGE_WIDTH = 595.28 // A4 en puntos
const PAGE_HEIGHT = 841.89
const MARGIN = 40
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const GRAPHITE = rgb(0x14 / 255, 0x18 / 255, 0x1d / 255)
const GRAY = rgb(0x4a / 255, 0x55 / 255, 0x68 / 255)
const COPPER = rgb(0xc1 / 255, 0x62 / 255, 0x2d / 255)
const STEEL_BG = rgb(0xf0 / 255, 0xf2 / 255, 0xf5 / 255)

function euro(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (current && font.widthOfTextAtSize(test, size) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

export type FacturaCompany = {
  razonSocial: string
  cif: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
}

export type FacturaClient = {
  nombre: string
  dni_nif: string | null
  direccion: string | null
  codigo_postal: string | null
  provincia: string | null
  telefono: string | null
  email: string | null
}

export type FacturaVehicle = {
  marca: string
  modelo: string
  matricula: string | null
  vin: string | null
  anio: number | null
  km: number | null
}

export async function buildFacturaRectificativaPdf(args: {
  company: FacturaCompany
  client: FacturaClient
  vehicle: FacturaVehicle
  precioOriginal: number
  precioNuevo: number
  motivo: string
  numeroFactura: string
  numeroOriginal: string
  fechaOriginal: string
}): Promise<Buffer> {
  const { company, client, vehicle, precioOriginal, precioNuevo, motivo, numeroFactura, numeroOriginal, fechaOriginal } =
    args
  const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const fechaOriginalFmt = new Date(fechaOriginal).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

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

  function paragraph(value: string, { size = 8, color = GRAY }: { size?: number; color?: any } = {}) {
    for (const line of wrapText(value, font, size, CONTENT_WIDTH)) {
      page.drawText(line, { x: MARGIN, y, size, font, color })
      y -= size * 1.5
    }
  }

  // Membrete
  text(company.razonSocial, { size: 16, bold: true, gap: 2 })
  if (company.cif) text(`CIF: ${company.cif}`, { size: 9, color: GRAY })
  if (company.direccion) text(company.direccion, { size: 9, color: GRAY })
  const companyContact = [company.telefono, company.email].filter(Boolean).join(' · ')
  if (companyContact) text(companyContact, { size: 9, color: GRAY })

  y -= 6
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 2, color: COPPER })
  y -= 24

  // Título
  text('Factura rectificativa', { size: 18, bold: true, gap: 2 })
  text(`Nº ${numeroFactura} · Fecha: ${fecha}`, { size: 9, color: GRAY, gap: 4 })
  text(`Rectifica a la factura nº ${numeroOriginal}, de fecha ${fechaOriginalFmt}`, {
    size: 9,
    color: GRAY,
    gap: 14,
  })

  // Cliente
  text('CLIENTE', { size: 9, bold: true, color: GRAY, gap: 4 })
  text(client.nombre, { size: 11, bold: true })
  if (client.dni_nif) text(`DNI/NIF: ${client.dni_nif}`, { size: 10 })
  if (client.direccion) text(client.direccion, { size: 10 })
  const clientLocalidad = [client.codigo_postal, client.provincia].filter(Boolean).join(' ')
  if (clientLocalidad) text(clientLocalidad, { size: 10 })
  const clientContact = [client.telefono, client.email].filter(Boolean).join(' · ')
  if (clientContact) text(clientContact, { size: 10 })
  y -= 12

  // Vehículo
  text('VEHÍCULO', { size: 9, bold: true, color: GRAY, gap: 4 })
  text(`${vehicle.marca} ${vehicle.modelo}`, { size: 11, bold: true, gap: 2 })
  const vehicleFields: [string, string | number | null][] = [
    ['Matrícula', vehicle.matricula],
    ['Bastidor / VIN', vehicle.vin],
    ['Año', vehicle.anio],
    ['Kilómetros', vehicle.km !== null ? `${vehicle.km.toLocaleString('es-ES')} km` : null],
  ]
  for (const [label, value] of vehicleFields) {
    if (value === null || value === '') continue
    text(`${label}: ${value}`, { size: 10 })
  }
  y -= 12

  // Motivo
  text('MOTIVO DE LA RECTIFICACIÓN', { size: 9, bold: true, color: GRAY, gap: 4 })
  paragraph(motivo, { size: 10, color: GRAPHITE })
  y -= 12

  // Importes: original, nuevo y diferencia
  const boxHeight = 78
  page.drawRectangle({ x: MARGIN, y: y - boxHeight, width: CONTENT_WIDTH, height: boxHeight, color: STEEL_BG })
  const colWidth = CONTENT_WIDTH / 3
  const rows: [string, string][] = [
    ['Importe original', euro(precioOriginal)],
    ['Importe corregido', euro(precioNuevo)],
    ['Diferencia', euro(precioNuevo - precioOriginal)],
  ]
  rows.forEach(([label, value], i) => {
    const colX = MARGIN + colWidth * i
    const labelWidth = font.widthOfTextAtSize(label, 9)
    page.drawText(label, { x: colX + (colWidth - labelWidth) / 2, y: y - 24, size: 9, font, color: GRAY })
    const valueWidth = fontBold.widthOfTextAtSize(value, 15)
    page.drawText(value, { x: colX + (colWidth - valueWidth) / 2, y: y - 48, size: 15, font: fontBold, color: GRAPHITE })
  })
  y -= boxHeight + 30

  // Nota legal REBU
  paragraph(
    'Operación acogida al Régimen Especial de Bienes Usados (REBU), conforme al artículo 135 y siguientes de la Ley ' +
      '37/1992 del IVA. En aplicación de dicho régimen, no procede el desglose del Impuesto sobre el Valor Añadido en ' +
      'esta factura.'
  )

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
