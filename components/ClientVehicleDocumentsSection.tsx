'use client'

import { useState } from 'react'
import SendDocumentsModal, { type SendableDoc } from './SendDocumentsModal'

type Doc = SendableDoc & { url: string | null }

type VehiculoConDocs = {
  vehicleId: string
  vehiculoLabel: string
  documentos: Doc[]
}

// Documentos de todos los vehículos vinculados a un cliente, agrupados por
// vehículo — cada uno con su propio selector de descarga/envío conjunto
// (reutiliza el mismo modal que la ficha del vehículo).
export default function ClientVehicleDocumentsSection({
  vehiculos,
  clienteEmail,
}: {
  vehiculos: VehiculoConDocs[]
  clienteEmail: string | null
}) {
  const [modalVehicleId, setModalVehicleId] = useState<string | null>(null)
  const vehiculoAbierto = vehiculos.find((v) => v.vehicleId === modalVehicleId)

  const conDocumentos = vehiculos.filter((v) => v.documentos.length > 0)

  return (
    <section className="detail-section">
      <h2>Documentos de sus vehículos</h2>

      {conDocumentos.length === 0 && (
        <p className="empty-state">Ninguno de sus vehículos vinculados tiene documentos todavía.</p>
      )}

      {conDocumentos.map((v) => (
        <div key={v.vehicleId} style={{ marginBottom: 16 }}>
          <h3>{v.vehiculoLabel}</h3>
          <ul className="pending-list">
            {v.documentos.map((doc) => (
              <li key={doc.id}>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer">
                    {doc.label} — {doc.nombre_archivo}
                  </a>
                ) : (
                  `${doc.label} — ${doc.nombre_archivo}`
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="secondary-btn" onClick={() => setModalVehicleId(v.vehicleId)}>
            Enviar documentación de este vehículo
          </button>
        </div>
      ))}

      {vehiculoAbierto && (
        <SendDocumentsModal
          vehicleId={vehiculoAbierto.vehicleId}
          vehiculoLabel={vehiculoAbierto.vehiculoLabel}
          documentos={vehiculoAbierto.documentos}
          clienteEmail={clienteEmail}
          onClose={() => setModalVehicleId(null)}
        />
      )}
    </section>
  )
}
