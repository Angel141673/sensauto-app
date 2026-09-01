'use client'

import { useState } from 'react'
import GenerateProformaModal from './GenerateProformaModal'

type Client = { id: string; nombre: string }

export default function GenerateProformaButton({
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
        Generar presupuesto
      </button>
      {open && (
        <GenerateProformaModal
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
