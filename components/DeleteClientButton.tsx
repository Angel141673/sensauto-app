'use client'

import { deleteClient } from '@/app/dashboard/clientes/actions'

export default function DeleteClientButton({
  clientId,
  clientNombre,
}: {
  clientId: string
  clientNombre: string
}) {
  return (
    <form
      action={deleteClient.bind(null, clientId)}
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
  )
}
