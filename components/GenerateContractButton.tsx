'use client'

import { useState } from 'react'
import GenerateContractModal from './GenerateContractModal'

type Client = { id: string; nombre: string }

export default function GenerateContractButton({
  vehicleId,
  vehiculoLabel,
  clients,
  precioSugerido,
  facturaImporte,
}: {
  vehicleId: string
  vehiculoLabel: string
  clients: Client[]
  precioSugerido: number | null
  facturaImporte: number | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" className="secondary-btn" onClick={() => setOpen(true)}>
        Generar contrato
      </button>
      {open && (
        <GenerateContractModal
          vehicleId={vehicleId}
          vehiculoLabel={vehiculoLabel}
          clients={clients}
          precioSugerido={precioSugerido}
          facturaImporte={facturaImporte}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
