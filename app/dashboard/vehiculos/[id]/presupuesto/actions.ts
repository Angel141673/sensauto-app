'use server'

import { createClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'

export type QuickClientState = {
  status: 'idle' | 'error'
  message?: string
  client?: { id: string; nombre: string }
}

// Alta rápida de cliente desde el modal de presupuesto — a diferencia de
// createClientRecord (clientes/actions.ts) no redirige, para poder
// seleccionar el cliente recién creado sin salir de la ficha del vehículo.
export async function createQuickClient(
  prevState: QuickClientState,
  formData: FormData
): Promise<QuickClientState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const nombre = String(formData.get('nombre') ?? '').trim()
  if (!nombre) {
    return { status: 'error', message: 'El nombre es obligatorio.' }
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      nombre,
      telefono: (formData.get('telefono') as string) || null,
      email: (formData.get('email') as string) || null,
      dni_nif: (formData.get('dni_nif') as string) || null,
      direccion: (formData.get('direccion') as string) || null,
      codigo_postal: (formData.get('codigo_postal') as string) || null,
      provincia: (formData.get('provincia') as string) || null,
      created_by: user.id,
    })
    .select('id, nombre')
    .single()

  if (error) {
    return { status: 'error', message: 'No se ha podido guardar el cliente. Inténtalo de nuevo.' }
  }

  return { status: 'idle', client: data }
}
