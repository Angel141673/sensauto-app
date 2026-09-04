'use client'

import { useFormState } from 'react-dom'
import { unlinkVehicleFromClient, type DeleteState } from '@/app/dashboard/clientes/actions'

const initialState: DeleteState = { status: 'idle' }

export default function UnlinkVehicleButton({
  operationId,
  clientId,
}: {
  operationId: string
  clientId: string
}) {
  const [state, formAction] = useFormState(unlinkVehicleFromClient.bind(null, operationId), initialState)

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="client_id" value={clientId} />
        <button type="submit" className="secondary-btn">
          Quitar vínculo
        </button>
      </form>
      {state.status === 'error' && (
        <p className="login-error" style={{ marginTop: 8 }}>
          {state.message}
        </p>
      )}
    </div>
  )
}
