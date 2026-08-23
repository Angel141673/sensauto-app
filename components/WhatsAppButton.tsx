'use client'

import { useState } from 'react'
import { WHATSAPP_TEMPLATES, buildWhatsAppLink, type WhatsAppTemplateKey } from '@/lib/whatsapp'

export default function WhatsAppButton({
  telefono,
  nombreCliente,
  vehiculoLabel,
}: {
  telefono: string | null
  nombreCliente: string
  vehiculoLabel?: string
}) {
  const [plantilla, setPlantilla] = useState<WhatsAppTemplateKey>('contacto')

  if (!telefono) {
    return <p className="form-note">Este cliente no tiene teléfono registrado.</p>
  }

  const mensaje = WHATSAPP_TEMPLATES[plantilla].texto(nombreCliente, vehiculoLabel)
  const link = buildWhatsAppLink(telefono, mensaje)

  return (
    <div className="whatsapp-box">
      <select value={plantilla} onChange={(e) => setPlantilla(e.target.value as WhatsAppTemplateKey)}>
        {Object.entries(WHATSAPP_TEMPLATES).map(([key, t]) => (
          <option key={key} value={key}>
            {t.label}
          </option>
        ))}
      </select>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className="whatsapp-btn">
          Abrir WhatsApp
        </a>
      ) : (
        <span className="form-note">Teléfono no válido para WhatsApp.</span>
      )}
    </div>
  )
}
