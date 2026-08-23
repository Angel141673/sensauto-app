'use client'

import { useRef, useState } from 'react'

export default function SignaturePad({
  onChange,
}: {
  onChange: (blob: Blob | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasSigned, setHasSigned] = useState(false)

  function getContext() {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true
    const ctx = getContext()
    const { x, y } = getPos(e)
    ctx?.beginPath()
    ctx?.moveTo(x, y)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = getContext()
    const { x, y } = getPos(e)
    if (ctx) {
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#14181d'
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    setHasSigned(true)
  }

  function handlePointerUp() {
    drawing.current = false
    exportBlob()
  }

  function exportBlob() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => onChange(blob), 'image/png')
  }

  function handleClear() {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    setHasSigned(false)
    onChange(null)
  }

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        width={560}
        height={220}
        className="signature-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="signature-actions">
        <span className="form-note" style={{ margin: 0 }}>
          {hasSigned ? 'Firma capturada.' : 'Firma aquí con el dedo o el lápiz.'}
        </span>
        <button type="button" className="secondary-btn" onClick={handleClear}>
          Borrar y repetir
        </button>
      </div>
    </div>
  )
}
