import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'

// Generación imperativa (sin React) a propósito: @react-pdf/renderer choca
// con la copia de React que Next.js App Router usa internamente para sus
// propios archivos server ("Minified React error #31" — dos instancias de
// React distintas), un problema conocido sin solución limpia mientras el
// proyecto siga en React 18. pdf-lib no depende de React, así que lo evita.

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

export type ProformaCompany = {
  name: string
  cif: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
}

export type ProformaClient = {
  nombre: string
  dni_nif: string | null
  direccion: string | null
  codigo_postal: string | null
  provincia: string | null
  telefono: string | null
  email: string | null
}

export type ProformaVehicle = {
  marca: string
  modelo: string
  matricula: string | null
  vin: string | null
  anio: number | null
  km: number | null
  motor: string | null
  color: string | null
  combustible: string | null
  transmision: string | null
}

export async function buildProformaPdf(args: {
  company: ProformaCompany
  client: ProformaClient
  vehicle: ProformaVehicle
  precio: number
}): Promise<Buffer> {
  const { company, client, vehicle, precio } = args
  const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

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
  text(company.name, { size: 16, bold: true, gap: 2 })
  if (company.cif) text(`CIF: ${company.cif}`, { size: 9, color: GRAY })
  if (company.direccion) text(company.direccion, { size: 9, color: GRAY })
  const companyContact = [company.telefono, company.email].filter(Boolean).join(' · ')
  if (companyContact) text(companyContact, { size: 9, color: GRAY })

  y -= 6
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 2,
    color: COPPER,
  })
  y -= 24

  // Título
  text('Presupuesto', { size: 18, bold: true, gap: 2 })
  text(`Fecha: ${fecha} · Válido durante 15 días desde la fecha de emisión`, { size: 9, color: GRAY, gap: 14 })

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
    ['Motor', vehicle.motor],
    ['Combustible', vehicle.combustible],
    ['Transmisión', vehicle.transmision],
    ['Color', vehicle.color],
  ]
  for (const [label, value] of vehicleFields) {
    if (value === null || value === '') continue
    text(`${label}: ${value}`, { size: 10 })
  }
  y -= 16

  // Precio
  const boxHeight = 60
  page.drawRectangle({
    x: MARGIN,
    y: y - boxHeight,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: STEEL_BG,
  })
  const priceLabelY = y - 20
  const priceLabel = 'Precio ofertado'
  const priceLabelWidth = font.widthOfTextAtSize(priceLabel, 9)
  page.drawText(priceLabel, {
    x: MARGIN + (CONTENT_WIDTH - priceLabelWidth) / 2,
    y: priceLabelY,
    size: 9,
    font,
    color: GRAY,
  })
  const priceValue = euro(precio)
  const priceValueWidth = fontBold.widthOfTextAtSize(priceValue, 22)
  page.drawText(priceValue, {
    x: MARGIN + (CONTENT_WIDTH - priceValueWidth) / 2,
    y: y - 44,
    size: 22,
    font: fontBold,
    color: GRAPHITE,
  })
  y -= boxHeight + 30

  // Nota legal
  paragraph(
    'Este documento es un presupuesto orientativo y no tiene validez como factura. Los vehículos de ocasión ' +
      'se venden bajo el Régimen Especial de Bienes Usados (REBU), por lo que no es posible desglosar el IVA. ' +
      'El precio final podría variar en función de la revisión definitiva del vehículo y de las condiciones ' +
      'acordadas en el momento de la compraventa.'
  )

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
