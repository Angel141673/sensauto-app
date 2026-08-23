// Analiza una foto de factura usando la API de Claude (Haiku 4.5).
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

const SYSTEM_PROMPT = `Eres un asistente que extrae datos de facturas españolas a partir de una foto.
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
      system: SYSTEM_PROMPT,
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
              text: 'Extrae los datos de esta factura siguiendo el formato indicado.',
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
    const parsed = JSON.parse(cleaned)
    return {
      proveedor: parsed.proveedor ?? null,
      fecha: parsed.fecha ?? null,
      base: parsed.base ?? null,
      iva: parsed.iva ?? null,
      total: parsed.total ?? null,
      vin: parsed.vin ?? null,
      confianza_total: parsed.confianza_total ?? 'baja',
    }
  } catch {
    throw new Error('No se ha podido interpretar la respuesta de la IA.')
  }
}
