'use client'

import { useFormState } from 'react-dom'
import { deleteVehicle, type DeleteVehicleState } from '@/app/dashboard/vehiculos/actions'

const initialState: DeleteVehicleState = { status: 'idle' }

export default function DeleteVehicleButton({
  vehicleId,
  vehiculoLabel,
}: {
  vehicleId: string
  vehiculoLabel: string
}) {
  const [state, formAction] = useFormState(deleteVehicle.bind(null, vehicleId), initialState)

  return (
    <div>
      <form
        action={formAction}
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
      {state.status === 'error' && (
        <p className="login-error" style={{ marginTop: 8 }}>
          {state.message}
        </p>
      )}
      {state.blockedBySignature && (
        <form
          action={formAction}
          style={{ marginTop: 8 }}
          onSubmit={(e) => {
            const ok = confirm(
              `Esto BORRARÁ también el contrato firmado de "${vehiculoLabel}" de forma permanente. No se puede deshacer. ¿Eliminar de todas formas?`
            )
            if (!ok) e.preventDefault()
          }}
        >
          <input type="hidden" name="force" value="true" />
          <button type="submit" className="secondary-btn danger-btn">
            Eliminar de todas formas (borra también el contrato firmado)
          </button>
        </form>
      )}
    </div>
  )
}
