import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'

// Misma técnica que proformaPdf.ts (pdf-lib, sin React) y por el mismo
// motivo: @react-pdf/renderer choca con la copia de React que usa
// internamente el App Router de Next.js 15 en React 18.

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

function fechaLarga(value?: string | null) {
  const d = value ? new Date(value) : new Date()
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
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

export type ContractCompany = {
  razonSocial: string
  cif: string | null
  direccion: string | null
  email: string | null
  telefono: string | null
  datosBancarios: string | null
}

export type ContractClient = {
  nombre: string
  dni_nif: string | null
  direccion: string | null
  codigo_postal: string | null
  provincia: string | null
  telefono: string | null
  email: string | null
}

export type ContractVehicle = {
  marca: string
  modelo: string
  matricula: string | null
  vin: string | null
  fecha_matriculacion: string | null
  km: number | null
  combustible: string | null
  transmision: string | null
  motor: string | null
  color: string | null
}

class PdfWriter {
  doc: PDFDocument
  page: PDFPage
  font: PDFFont
  fontBold: PDFFont
  y: number

  constructor(doc: PDFDocument, font: PDFFont, fontBold: PDFFont) {
    this.doc = doc
    this.font = font
    this.fontBold = fontBold
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.y = PAGE_HEIGHT - MARGIN
  }

  ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      this.y = PAGE_HEIGHT - MARGIN
    }
  }

  text(value: string, { size = 10, bold = false, color = GRAPHITE, gap = 0 }: { size?: number; bold?: boolean; color?: any; gap?: number } = {}) {
    this.ensureSpace(size * 1.4 + gap)
    this.page.drawText(value, { x: MARGIN, y: this.y, size, font: bold ? this.fontBold : this.font, color })
    this.y -= size * 1.4 + gap
  }

  paragraph(value: string, { size = 9, color = GRAY }: { size?: number; color?: any } = {}) {
    for (const rawLine of value.split('\n')) {
      for (const line of wrapText(rawLine, this.font, size, CONTENT_WIDTH)) {
        this.ensureSpace(size * 1.5)
        this.page.drawText(line, { x: MARGIN, y: this.y, size, font: this.font, color })
        this.y -= size * 1.5
      }
    }
  }

  sectionHeader(title: string) {
    this.ensureSpace(30)
    this.y -= 4
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 1, color: COPPER })
    this.y -= 16
    this.text(title, { size: 10, bold: true, color: COPPER, gap: 6 })
  }

  clause(numero: string, titulo: string, cuerpo: string) {
    this.ensureSpace(9 * 1.5 * 2)
    this.text(`${numero}. ${titulo}`, { size: 9.5, bold: true, gap: 2 })
    this.paragraph(cuerpo, { size: 9 })
    this.y -= 6
  }

  checkbox(checked: boolean, label: string) {
    const size = 9
    this.ensureSpace(size * 1.6)
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - size + 1,
      width: size,
      height: size,
      borderColor: GRAPHITE,
      borderWidth: 1,
    })
    if (checked) {
      this.page.drawText('X', { x: MARGIN + 1.5, y: this.y - size + 1.5, size: size - 1, font: this.fontBold, color: GRAPHITE })
    }
    this.page.drawText(label, { x: MARGIN + size + 6, y: this.y - size + 1.5, size: 9, font: this.font, color: GRAPHITE })
    this.y -= size * 1.7
  }

  space(n: number) {
    this.y -= n
  }
}

function drawIdentificationBlock(
  w: PdfWriter,
  title: string,
  lines: (string | null)[]
) {
  w.sectionHeader(title)
  for (const line of lines) {
    if (!line) continue
    w.text(line, { size: 10, gap: 2 })
  }
  w.space(10)
}

function drawVehicleBlock(w: PdfWriter, vehicle: ContractVehicle) {
  w.sectionHeader('DATOS DEL VEHÍCULO')
  w.text(`${vehicle.marca} ${vehicle.modelo}`, { size: 11, bold: true, gap: 4 })
  const fields: [string, string | number | null][] = [
    ['Matrícula', vehicle.matricula],
    ['Bastidor / VIN', vehicle.vin],
    ['Fecha 1ª matriculación', vehicle.fecha_matriculacion ? fechaLarga(vehicle.fecha_matriculacion) : null],
    ['Kilómetros', vehicle.km !== null ? `${vehicle.km.toLocaleString('es-ES')} km` : null],
    ['Combustible', vehicle.combustible],
    ['Cambio', vehicle.transmision],
    ['Potencia / motor', vehicle.motor],
    ['Color', vehicle.color],
  ]
  for (const [label, value] of fields) {
    if (value === null || value === '') continue
    w.text(`${label}: ${value}`, { size: 10 })
  }
  w.space(10)
}

function clientLines(client: ContractClient): (string | null)[] {
  const localidad = [client.codigo_postal, client.provincia].filter(Boolean).join(' ')
  return [
    client.nombre,
    client.dni_nif ? `DNI / NIE: ${client.dni_nif}` : null,
    client.telefono ? `Teléfono: ${client.telefono}` : null,
    client.direccion,
    localidad || null,
    client.email,
  ]
}

// ============================================================
// CONTRATO DE COMPRAVENTA
// ============================================================

export type CompraventaEconomicos = {
  precio: number
  entregaACuenta: number | null
  formaPago: string | null
  fechaEntrega: string | null
  garantiaAmpliada: boolean
  garantiaImporte: number | null
  elementos: { llaves: boolean; chaleco: boolean; kit: boolean; documentacion: boolean }
  observaciones: string | null
}

const CLAUSULAS_COMPRAVENTA = (razonSocial: string): [string, string][] => [
  [
    'Primera. Objeto de la compraventa',
    `${razonSocial}, en adelante el vendedor, transmite al comprador la propiedad del vehículo descrito en el presente contrato, quien lo adquiere por el precio y en las condiciones pactadas entre ambas partes.`,
  ],
  [
    'Segunda. Capacidad y consentimiento',
    'Ambas partes manifiestan tener capacidad legal suficiente para contratar y obligarse, interviniendo libremente y prestando su consentimiento para formalizar la presente compraventa.',
  ],
  [
    'Tercera. Estado general del vehículo',
    'El comprador declara haber sido informado de que el vehículo objeto de compraventa es un vehículo de ocasión, con el uso, antigüedad, kilometraje y desgaste propios de su naturaleza. El comprador manifiesta haber podido inspeccionarlo antes de la firma.',
  ],
  [
    'Cuarta. Ausencia de cargas',
    'El vendedor manifiesta que, en el momento de la entrega, el vehículo se transmite libre de cargas, embargos, precintos, reservas de dominio o limitaciones de disposición que impidan su transmisión, salvo que se indique expresamente lo contrario en el apartado de observaciones.',
  ],
  [
    'Quinta. Kilometraje',
    'El vendedor declara que el kilometraje reflejado en el cuadro de instrumentos es el mostrado por el vehículo en el momento de la entrega y que no tiene conocimiento de manipulación o alteración del mismo.',
  ],
  [
    'Sexta. Documentación del vehículo',
    'La documentación original del vehículo podrá no entregarse en el mismo momento de la entrega física del vehículo, especialmente cuando existan trámites administrativos pendientes. En tal caso, se facilitará al comprador la documentación provisional necesaria, cuando proceda, y la documentación original se entregará o pondrá a disposición con posterioridad. Si el comprador solicita expresamente el envío de la documentación a su domicilio por correo ordinario, dicho envío tendrá un coste de 7,00 euros, que será asumido por el comprador.',
  ],
  [
    'Séptima. Cambio de titularidad',
    `${razonSocial} gestionará el cambio de titularidad del vehículo ante los organismos competentes, siempre que el comprador haya facilitado toda la documentación necesaria y haya satisfecho los importes pactados. El comprador se compromete a colaborar y a firmar cuantos documentos sean necesarios para completar el trámite.`,
  ],
  [
    'Novena. Entrega del vehículo',
    'La entrega del vehículo se realizará en la fecha indicada en el presente contrato o en la fecha que acuerden las partes. Desde la entrega, el comprador asume la posesión, custodia y uso del vehículo, así como las responsabilidades derivadas de su circulación, incluidas sanciones, multas, impuestos, seguros y cualesquiera obligaciones asociadas a su utilización.',
  ],
  [
    'Décima. Elementos entregados con el vehículo',
    'El comprador declara recibir el vehículo con los elementos marcados en el apartado de declaración de entrega, incluyendo, en su caso, dos llaves, chaleco reflectante, kit reparapinchazos y documentación provisional necesaria para circular. No se entenderán incluidos manuales de usuario ni libros de mantenimiento físicos cuando dichos elementos sean digitales o no se entreguen expresamente.',
  ],
  [
    'Undécima. Estado del vehículo y conformidad de la entrega',
    'El comprador declara haber inspeccionado personalmente el estado exterior e interior del vehículo antes de su entrega, comprobando que se corresponde con el estado pactado y mostrando su conformidad con el mismo. Asimismo, manifiesta haber tenido la oportunidad de revisar el funcionamiento general del vehículo y recibir cuantas explicaciones ha considerado necesarias antes de formalizar la compraventa.',
  ],
  [
    'Duodécima. Condiciones pactadas',
    'El vehículo se entrega en las condiciones expresamente pactadas entre las partes. Cualquier compromiso adicional, reparación pendiente, accesorio incluido o condición especial deberá constar por escrito en el apartado de observaciones o en documento anexo firmado por ambas partes.',
  ],
  [
    'Decimotercera. Mantenimiento y uso adecuado',
    'El comprador reconoce haber sido informado de la necesidad de realizar los mantenimientos periódicos conforme a las indicaciones del fabricante y de conservar justificantes de dichos mantenimientos. La falta de mantenimiento, el uso indebido, negligente o contrario a las instrucciones del fabricante podrá afectar a la cobertura de garantía cuando guarde relación directa con la incidencia reclamada.',
  ],
  [
    'Decimocuarta. Consumibles y elementos de desgaste',
    'Salvo pacto escrito en contrario o garantía legal que resulte aplicable, no se consideran cubiertos los elementos sometidos a desgaste por uso ordinario, tales como neumáticos, escobillas, lámparas, líquidos, filtros, tapicerías, gomas, molduras, llantas, elementos estéticos o consumibles análogos.',
  ],
  [
    'Decimoquinta. Modificaciones y manipulaciones posteriores',
    'Cualquier modificación mecánica, electrónica, estética o de software realizada en el vehículo por el comprador o por terceros con posterioridad a la entrega será responsabilidad exclusiva del comprador. Si dicha modificación guarda relación con una avería o incidencia, podrá afectar a la cobertura correspondiente.',
  ],
  [
    'Decimosexta. Impuestos, gastos y sanciones',
    'Desde la entrega del vehículo, el comprador asumirá las sanciones, multas, peajes, impuestos, gastos de estacionamiento, seguros y cualquier otra responsabilidad que derive del uso o posesión del vehículo, aunque el cambio de titularidad administrativo se encuentre en tramitación.',
  ],
  [
    'Decimoséptima. Protección de datos',
    `Los datos personales del comprador serán tratados por ${razonSocial} con la finalidad de gestionar la compraventa, tramitar el cambio de titularidad, cumplir obligaciones legales, fiscales y administrativas, así como conservar la documentación contractual durante los plazos legalmente exigibles.`,
  ],
  [
    'Decimoctava. Comunicaciones',
    'Las comunicaciones relacionadas con la compraventa podrán realizarse a través del teléfono, correo electrónico o domicilio indicados por el comprador en el presente contrato, salvo que este comunique por escrito otros datos de contacto.',
  ],
  [
    'Decimonovena. Anexos',
    'Formarán parte del presente contrato los anexos, justificantes, presupuestos, documentos de garantía comercial, informes o condiciones particulares que se firmen por ambas partes y se incorporen al expediente de venta.',
  ],
  [
    'Vigésima. Jurisdicción y normativa aplicable',
    'El presente contrato se regirá por la normativa española aplicable. Para cualquier controversia derivada de la compraventa, las partes se someterán a los juzgados y tribunales que resulten competentes conforme a la legislación vigente.',
  ],
  [
    'Vigesimoprimera. Recambios durante la garantía',
    'Las reparaciones realizadas al amparo de la garantía podrán efectuarse mediante la instalación de recambios originales, equivalentes, compatibles o procedentes de Centros Autorizados de Tratamiento de Vehículos (CAT), de conformidad con la legislación vigente y siempre que sean aptos para garantizar el correcto funcionamiento y la seguridad del vehículo. El comprador acepta expresamente esta condición.',
  ],
]

export async function buildCompraventaPdf(args: {
  company: ContractCompany
  client: ContractClient
  vehicle: ContractVehicle
  economicos: CompraventaEconomicos
}): Promise<Buffer> {
  const { company, client, vehicle, economicos } = args

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const w = new PdfWriter(pdfDoc, font, fontBold)

  w.text(company.razonSocial, { size: 16, bold: true, gap: 2 })
  w.text('Contrato de compraventa de vehículo de ocasión', { size: 12, bold: true, gap: 8 })
  w.text(`Fecha del contrato: ${fechaLarga()}`, { size: 9, color: GRAY, gap: 10 })

  drawIdentificationBlock(w, 'DATOS DEL VENDEDOR', [
    company.razonSocial,
    company.cif ? `CIF: ${company.cif}` : null,
    company.direccion ? `Domicilio: ${company.direccion}` : null,
  ])

  drawIdentificationBlock(w, 'DATOS DEL COMPRADOR', clientLines(client))

  drawVehicleBlock(w, vehicle)

  w.sectionHeader('CONDICIONES ECONÓMICAS')
  w.text(`Precio final pactado: ${euro(economicos.precio)}`, { size: 10 })
  if (economicos.entregaACuenta) {
    w.text(`Entrega a cuenta / reserva: ${euro(economicos.entregaACuenta)}`, { size: 10 })
    w.text(`Importe pendiente: ${euro(economicos.precio - economicos.entregaACuenta)}`, { size: 10 })
  }
  if (economicos.formaPago) w.text(`Forma de pago: ${economicos.formaPago}`, { size: 10 })
  if (economicos.fechaEntrega) w.text(`Fecha de entrega: ${fechaLarga(economicos.fechaEntrega)}`, { size: 10 })
  w.space(6)
  w.paragraph(
    'El precio indicado se corresponde con las condiciones pactadas entre las partes y con los elementos expresamente incluidos en el presente contrato. Cualquier accesorio, servicio o garantía comercial adicional deberá constar de forma expresa en este documento o en su anexo correspondiente.'
  )
  w.space(10)

  w.sectionHeader('CLÁUSULAS CONTRACTUALES')
  for (const [titulo, cuerpo] of CLAUSULAS_COMPRAVENTA(company.razonSocial)) {
    const [numero, ...resto] = titulo.split('. ')
    w.clause(numero, resto.join('. '), cuerpo)
  }

  w.sectionHeader('OCTAVA. GARANTÍA LEGAL Y GARANTÍA COMERCIAL OPCIONAL')
  w.paragraph(
    'El vehículo se entrega con la garantía legal aplicable conforme a la normativa vigente para vehículos usados vendidos por empresarios a consumidores. Dicha garantía no cubre desgastes normales derivados del uso, mantenimiento ordinario, consumibles, averías causadas por uso negligente, manipulaciones, modificaciones realizadas por terceros, accidentes o falta de mantenimiento, sin perjuicio de los derechos que legalmente correspondan al comprador. El comprador ha sido informado de la posibilidad de contratar una garantía comercial ampliada, con un coste adicional, que amplía la cobertura del vehículo conforme a las condiciones de la póliza o documento de garantía correspondiente.'
  )
  w.space(4)
  w.checkbox(!economicos.garantiaAmpliada, 'El comprador NO contrata la garantía comercial ampliada.')
  w.checkbox(
    economicos.garantiaAmpliada,
    `El comprador SÍ contrata la garantía comercial ampliada${economicos.garantiaImporte ? ` por importe de ${euro(economicos.garantiaImporte)}` : ''}.`
  )
  w.space(10)

  if (economicos.observaciones) {
    w.sectionHeader('OBSERVACIONES / CONDICIONES PARTICULARES')
    w.paragraph(economicos.observaciones)
    w.space(10)
  }

  w.sectionHeader('DECLARACIÓN DE ENTREGA Y FIRMAS')
  w.paragraph(
    'El comprador declara haber recibido el vehículo objeto de la presente compraventa en la fecha indicada, junto con los elementos descritos en este contrato, manifestando su conformidad con la entrega efectuada y reconociendo haber recibido la información necesaria sobre el funcionamiento y utilización del vehículo.'
  )
  w.space(8)
  w.text('Elementos entregados', { size: 9.5, bold: true, gap: 4 })
  w.checkbox(economicos.elementos.llaves, 'Dos llaves')
  w.checkbox(economicos.elementos.chaleco, 'Chaleco reflectante')
  w.checkbox(economicos.elementos.kit, 'Kit reparapinchazos')
  w.checkbox(economicos.elementos.documentacion, 'Documentación provisional necesaria para circular')
  w.space(24)

  const colWidth = CONTENT_WIDTH / 2
  w.ensureSpace(80)
  const sigY = w.y
  w.page.drawText('EL VENDEDOR', { x: MARGIN, y: sigY, size: 9.5, font: fontBold, color: GRAPHITE })
  w.page.drawText('EL COMPRADOR', { x: MARGIN + colWidth, y: sigY, size: 9.5, font: fontBold, color: GRAPHITE })
  w.y -= 40
  w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: MARGIN + colWidth - 20, y: w.y }, thickness: 0.5, color: GRAY })
  w.page.drawLine({ start: { x: MARGIN + colWidth, y: w.y }, end: { x: PAGE_WIDTH - MARGIN, y: w.y }, thickness: 0.5, color: GRAY })
  w.y -= 12
  w.page.drawText(company.razonSocial, { x: MARGIN, y: w.y, size: 8, font, color: GRAY })
  w.page.drawText(client.nombre, { x: MARGIN + colWidth, y: w.y, size: 8, font, color: GRAY })

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}

// ============================================================
// DOCUMENTO DE RESERVA
// ============================================================
//
// Basado en la plantilla real "Documento de reserva" aportada por el
// usuario (Documento_Reserva_SENSAUTO), parametrizada por empresa.

export type ReservaEconomicos = {
  precioTotal: number
  senal: number
  fechaLimite: string | null
  plazoDias: number
  condicionadaFinanciacion: boolean
  observaciones: string | null
}

const CLAUSULAS_RESERVA = (razonSocial: string, plazoDias: number): [string, string][] => [
  [
    'Primera. Objeto de la reserva',
    `El comprador entrega a ${razonSocial} la cantidad indicada en concepto de reserva. El vehículo quedará retirado de la venta durante el plazo de reserva.`,
  ],
  [
    'Segunda. Plazo de reserva',
    `La reserva tendrá una duración de ${plazoDias} días naturales desde la firma del presente documento.`,
  ],
  [
    'Tercera. Importe de la reserva',
    'La cantidad entregada se descontará íntegramente del precio final si se formaliza la compraventa.',
  ],
  [
    'Cuarta. Desistimiento del comprador',
    'Si el comprador decide no continuar con la compra, la reserva no será devuelta al compensar la inmovilización del vehículo y los perjuicios ocasionados.',
  ],
  [
    'Quinta. Supuestos de devolución',
    `La reserva solo se devolverá cuando: a) la financiación sea denegada (si la operación está condicionada a financiación); b) tras la inspección se acrediten diferencias sustanciales entre el estado real del vehículo y lo anunciado por ${razonSocial}. Fuera de estos supuestos la reserva no será reintegrada.`,
  ],
]

function drawVehicleBlockReserva(w: PdfWriter, vehicle: ContractVehicle, precio: number) {
  w.sectionHeader('DATOS DEL VEHÍCULO')
  w.text(`Marca / Modelo: ${vehicle.marca} ${vehicle.modelo}`, { size: 10 })
  if (vehicle.matricula) w.text(`Matrícula: ${vehicle.matricula}`, { size: 10 })
  if (vehicle.vin) w.text(`Bastidor: ${vehicle.vin}`, { size: 10 })
  if (vehicle.km !== null) w.text(`Kilómetros: ${vehicle.km.toLocaleString('es-ES')} km`, { size: 10 })
  w.text(`Precio: ${euro(precio)}`, { size: 10 })
  w.space(10)
}

export async function buildReservaPdf(args: {
  company: ContractCompany
  client: ContractClient
  vehicle: ContractVehicle
  economicos: ReservaEconomicos
}): Promise<Buffer> {
  const { company, client, vehicle, economicos } = args

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const w = new PdfWriter(pdfDoc, font, fontBold)

  w.text(company.razonSocial, { size: 16, bold: true, gap: 2 })
  w.text('Documento de reserva de vehículo', { size: 12, bold: true, gap: 8 })
  w.text(`Fecha: ${fechaLarga()}`, { size: 9, color: GRAY, gap: 10 })

  drawIdentificationBlock(w, 'DATOS DEL COMPRADOR', [
    client.nombre,
    client.dni_nif ? `DNI/NIE: ${client.dni_nif}` : null,
    client.direccion,
    client.telefono ? `Teléfono: ${client.telefono}` : null,
    client.email,
  ])

  drawVehicleBlockReserva(w, vehicle, economicos.precioTotal)

  w.sectionHeader('CONDICIONES ECONÓMICAS')
  w.text(`Importe de la reserva: ${euro(economicos.senal)}`, { size: 10 })
  w.text(`Importe pendiente: ${euro(economicos.precioTotal - economicos.senal)}`, { size: 10 })
  w.text(`Precio total de la compraventa: ${euro(economicos.precioTotal)}`, { size: 10 })
  if (economicos.fechaLimite) {
    w.text(`Fecha límite para formalizar la compraventa: ${fechaLarga(economicos.fechaLimite)}`, { size: 10 })
  }
  w.space(10)

  if (company.datosBancarios) {
    w.sectionHeader('NÚMERO DE CUENTA')
    w.paragraph(company.datosBancarios, { size: 9, color: GRAPHITE })
    w.text(`Beneficiario: ${company.razonSocial}`, { size: 9 })
    w.space(10)
  }

  w.sectionHeader('DECLARACIÓN PREVIA DEL COMPRADOR')
  w.paragraph(
    'El comprador declara haber recibido información suficiente sobre el vehículo objeto de la presente reserva, conocer sus características y estado general, y aceptar expresamente las condiciones establecidas en el presente documento de reserva.'
  )
  w.space(10)

  for (const [titulo, cuerpo] of CLAUSULAS_RESERVA(company.razonSocial, economicos.plazoDias)) {
    const [numero, ...resto] = titulo.split('. ')
    w.clause(numero, resto.join('. '), cuerpo)
  }

  w.checkbox(economicos.condicionadaFinanciacion, 'Operación condicionada a financiación')
  w.checkbox(!economicos.condicionadaFinanciacion, 'Operación NO condicionada a financiación')
  w.space(10)

  w.sectionHeader('OBSERVACIONES')
  if (economicos.observaciones) {
    w.paragraph(economicos.observaciones)
  } else {
    w.text('________________________________________________________________________________', { size: 9, color: GRAY })
    w.text('________________________________________________________________________________', { size: 9, color: GRAY })
  }
  w.space(20)

  const colWidth = CONTENT_WIDTH / 2
  w.ensureSpace(80)
  const sigY = w.y
  w.page.drawText(company.razonSocial, { x: MARGIN, y: sigY, size: 9.5, font: fontBold, color: GRAPHITE })
  w.page.drawText('EL COMPRADOR', { x: MARGIN + colWidth, y: sigY, size: 9.5, font: fontBold, color: GRAPHITE })
  w.y -= 14
  w.page.drawText('Firma y sello', { x: MARGIN, y: w.y, size: 8, font, color: GRAY })
  w.page.drawText('Firma', { x: MARGIN + colWidth, y: w.y, size: 8, font, color: GRAY })
  w.y -= 40
  w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: MARGIN + colWidth - 20, y: w.y }, thickness: 0.5, color: GRAY })
  w.page.drawLine({ start: { x: MARGIN + colWidth, y: w.y }, end: { x: PAGE_WIDTH - MARGIN, y: w.y }, thickness: 0.5, color: GRAY })
  w.y -= 12
  w.page.drawText(client.nombre, { x: MARGIN + colWidth, y: w.y, size: 8, font, color: GRAY })

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
