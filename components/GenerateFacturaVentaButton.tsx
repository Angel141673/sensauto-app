'use client'

import { useState } from 'react'
import GenerateFacturaVentaModal from './GenerateFacturaVentaModal'

type Client = { id: string; nombre: string }

export default function GenerateFacturaVentaButton({
  vehicleId,
  vehiculoLabel,
  clients,
  precioSugerido,
}: {
  vehicleId: string
  vehiculoLabel: string
  clients: Client[]
  precioSugerido: number | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" className="secondary-btn" onClick={() => setOpen(true)}>
        Generar factura de venta
      </button>
      {open && (
        <GenerateFacturaVentaModal
          vehicleId={vehicleId}
          vehiculoLabel={vehiculoLabel}
          clients={clients}
          precioSugerido={precioSugerido}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
