'use client'

import { deleteVehicle } from '@/app/dashboard/vehiculos/actions'

export default function DeleteVehicleButton({
  vehicleId,
  vehiculoLabel,
}: {
  vehicleId: string
  vehiculoLabel: string
}) {
  return (
    <form
      action={deleteVehicle.bind(null, vehicleId)}
      onSubmit={(e) => {
        const ok = confirm(
          `¿Eliminar "${vehiculoLabel}"? Se borrarán también sus documentos, ficha técnica y gastos asociados. Esta acción no se puede deshacer.`
        )
        if (!ok) e.preventDefault()
      }}
    >
      <button type="submit" className="secondary-btn">
        Eliminar vehículo
      </button>
    </form>
  )
}
