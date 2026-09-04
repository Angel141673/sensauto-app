'use client'

import { useFormState } from 'react-dom'
import { deleteClient, type DeleteState } from '@/app/dashboard/clientes/actions'

const initialState: DeleteState = { status: 'idle' }

export default function DeleteClientButton({
  clientId,
  clientNombre,
}: {
  clientId: string
  clientNombre: string
}) {
  const [state, formAction] = useFormState(deleteClient.bind(null, clientId), initialState)

  return (
    <div>
      <form
        action={formAction}
        onSubmit={(e) => {
          const ok = confirm(
            `¿Eliminar a "${clientNombre}"? Se borrarán también sus documentos generales. Esta acción no se puede deshacer.`
          )
          if (!ok) e.preventDefault()
        }}
      >
        <button type="submit" className="secondary-btn">
          Eliminar cliente
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
              `Esto BORRARÁ también el contrato firmado de "${clientNombre}" de forma permanente. No se puede deshacer. ¿Eliminar de todas formas?`
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
