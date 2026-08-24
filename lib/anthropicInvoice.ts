// Analiza fotos de facturas usando la API de Claude (Haiku 4.5).
// Coste aproximado: menos de un céntimo de euro por factura.
// Requiere la variable de entorno ANTHROPIC_API_KEY.

export type InvoiceAnalysis = {
  proveedor: string | null
  fecha: string | null // formato YYYY-MM-DD
  base: number | null
  iva: number | null
  total: number | null
  vin: string | null
  confianza_total: 'alta' | 'media' | 'baja'
}

export type VehiclePurchaseAnalysis = {
  marca: string | null
  modelo: string | null
  vin: string | null // tal cual aparece en la factura, sin corregir ni completar
  fecha_matriculacion: string | null // formato YYYY-MM-DD
  motor: string | null // motorización + potencia, ej. "2.0 TDI 150 CV"
  km: number | null
  precio_compra: number | null
  color: string | null
  matricula: string | null
  confianza_total: 'alta' | 'media' | 'baja'
}

// Llama a Claude con una imagen y un prompt de sistema, y devuelve el JSON
// ya parseado. Compartido por las distintas funciones de análisis de
// facturas de esta app (gastos, compra de vehículo...).
async function callClaudeVisionJSON(
  imageBase64: string,
  mimeType: string,
  systemPrompt: string,
  userText: string
): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY no está configurada. Añádela a las variables de entorno para activar el análisis con IA.'
    )
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: userText,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Error al llamar a la API de Claude (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const textBlock = data.content?.find((block: any) => block.type === 'text')

  if (!textBlock) {
    throw new Error('La IA no ha devuelto una respuesta legible.')
  }

  try {
    // Por si acaso el modelo envuelve el JSON en bloques de código.
    const cleaned = textBlock.text.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    throw new Error('No se ha podido interpretar la respuesta de la IA.')
  }
}

const INVOICE_SYSTEM_PROMPT = `Eres un asistente que extrae datos de facturas españolas a partir de una foto.
Responde ÚNICAMENTE con un objeto JSON, sin texto adicional, sin markdown, con esta forma exacta:
{
  "proveedor": string o null,
  "fecha": string en formato YYYY-MM-DD o null,
  "base": number o null (base imponible, sin IVA),
  "iva": number o null (importe del IVA, no el porcentaje),
  "total": number o null,
  "vin": string o null (bastidor/VIN de 17 caracteres si aparece en la factura, por ejemplo en facturas de piezas o trámites de un vehículo concreto),
  "confianza_total": "alta", "media" o "baja" según lo clara y legible que sea la cifra del total en la imagen
}
Si algún dato no aparece o no estás seguro, usa null para ese campo. Nunca inventes cifras.`

export async function analyzeInvoiceImage(
  imageBase64: string,
  mimeType: string
): Promise<InvoiceAnalysis> {
  const parsed = await callClaudeVisionJSON(
    imageBase64,
    mimeType,
    INVOICE_SYSTEM_PROMPT,
    'Extrae los datos de esta factura siguiendo el formato indicado.'
  )

  return {
    proveedor: parsed.proveedor ?? null,
    fecha: parsed.fecha ?? null,
    base: parsed.base ?? null,
    iva: parsed.iva ?? null,
    total: parsed.total ?? null,
    vin: parsed.vin ?? null,
    confianza_total: parsed.confianza_total ?? 'baja',
  }
}

const VEHICLE_PURCHASE_SYSTEM_PROMPT = `Eres un asistente que extrae datos de facturas españolas de COMPRA de un
vehículo (de un concesionario, subasta o particular) a partir de una foto.
Responde ÚNICAMENTE con un objeto JSON, sin texto adicional, sin markdown, con esta forma exacta:
{
  "marca": string o null,
  "modelo": string o null,
  "vin": string o null (bastidor/VIN del vehículo, tal y como aparece escrito en la factura, sin corregirlo ni completarlo aunque no tenga 17 caracteres — puede aparecer como "VIN", "Bastidor" o "N° de bastidor"),
  "fecha_matriculacion": string en formato YYYY-MM-DD o null (fecha completa de matriculación con día, mes y año — puede aparecer como "Fecha de matriculación", "1ª matriculación" o similar; si solo hay un año sin día ni mes, usa null),
  "motor": string o null (motorización y potencia juntas en un solo texto, ej. "2.0 TDI 150 CV" — puede aparecer como "Motor", "Cilindrada", o la cilindrada junto con la potencia en CV o kW; combínalos en un único texto legible),
  "km": number o null (kilómetros del vehículo),
  "precio_compra": number o null (precio total de compra del vehículo),
  "color": string o null,
  "matricula": string o null (si el vehículo ya está matriculado; si es un vehículo nuevo sin matricular, usa null)
  "confianza_total": "alta", "media" o "baja" según lo clara y legible que sea la información en la imagen
}
No inventes ni completes ningún dato que no puedas leer con claridad en la
imagen. Devuelve el VIN exactamente como aparece escrito, aunque te parezca
que le faltan o sobran caracteres — la validación de formato la hace la
aplicación, no tú.`

export async function analyzeVehiclePurchaseInvoice(
  imageBase64: string,
  mimeType: string
): Promise<VehiclePurchaseAnalysis> {
  const parsed = await callClaudeVisionJSON(
    imageBase64,
    mimeType,
    VEHICLE_PURCHASE_SYSTEM_PROMPT,
    'Extrae los datos de esta factura de compra de vehículo siguiendo el formato indicado.'
  )

  return {
    marca: parsed.marca ?? null,
    modelo: parsed.modelo ?? null,
    vin: parsed.vin ?? null,
    fecha_matriculacion: parsed.fecha_matriculacion ?? null,
    motor: parsed.motor ?? null,
    km: parsed.km ?? null,
    precio_compra: parsed.precio_compra ?? null,
    color: parsed.color ?? null,
    matricula: parsed.matricula ?? null,
    confianza_total: parsed.confianza_total ?? 'baja',
  }
}
