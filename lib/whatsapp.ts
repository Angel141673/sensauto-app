export type WhatsAppTemplateKey =
  | 'contacto'
  | 'informacion'
  | 'reserva'
  | 'documentacion'
  | 'preparacion'
  | 'entrega'
  | 'posventa'

export const WHATSAPP_TEMPLATES: Record<WhatsAppTemplateKey, { label: string; texto: (nombre: string, vehiculo?: string) => string }> = {
  contacto: {
    label: 'Contacto',
    texto: (nombre) => `Hola ${nombre}, te escribimos desde SENSAUTO. ¿En qué podemos ayudarte?`,
  },
  informacion: {
    label: 'Información',
    texto: (nombre, vehiculo) =>
      `Hola ${nombre}, te enviamos más información${vehiculo ? ` sobre el ${vehiculo}` : ''}. Cualquier duda, estamos disponibles.`,
  },
  reserva: {
    label: 'Reserva',
    texto: (nombre, vehiculo) =>
      `Hola ${nombre}, confirmamos la reserva${vehiculo ? ` del ${vehiculo}` : ''}. En breve te enviamos los siguientes pasos.`,
  },
  documentacion: {
    label: 'Documentación',
    texto: (nombre) =>
      `Hola ${nombre}, necesitamos que nos envíes la documentación pendiente cuando puedas, gracias.`,
  },
  preparacion: {
    label: 'Preparación',
    texto: (nombre, vehiculo) =>
      `Hola ${nombre}, tu vehículo${vehiculo ? ` (${vehiculo})` : ''} está en preparación. Te avisamos en cuanto esté listo.`,
  },
  entrega: {
    label: 'Entrega',
    texto: (nombre, vehiculo) =>
      `Hola ${nombre}, tu vehículo${vehiculo ? ` (${vehiculo})` : ''} ya está listo para la entrega. ¿Cuándo te viene bien pasar?`,
  },
  posventa: {
    label: 'Posventa',
    texto: (nombre) =>
      `Hola ${nombre}, ¿qué tal todo con el vehículo? Cualquier cosa que necesites, aquí estamos.`,
  },
}

// Normaliza el teléfono a formato internacional para wa.me.
// Si el número tiene 9 dígitos y no lleva prefijo, asume España (+34).
export function normalizePhoneForWhatsApp(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '')
  if (!digits) return null

  if (digits.startsWith('+')) return digits.slice(1)
  if (digits.length === 9) return `34${digits}`
  return digits
}

export function buildWhatsAppLink(phone: string, message: string): string | null {
  const normalized = normalizePhoneForWhatsApp(phone)
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}
