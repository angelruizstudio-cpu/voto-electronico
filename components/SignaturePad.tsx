"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

type SignaturePadProps = {
  label: string
  onChange: (dataUrl: string | null) => void
}

export function SignaturePad({ label, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dibujandoRef = useRef(false)
  const [tieneFirma, setTieneFirma] = useState(false)

  const obtenerPunto = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    return {
      x: ((evento.clientX - rect.left) / rect.width) * canvas.width,
      y: ((evento.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const exportarFirma = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setTieneFirma(true)
    onChange(canvas.toDataURL("image/png"))
  }

  const limpiar = () => {
    const canvas = canvasRef.current
    const contexto = canvas?.getContext("2d")
    if (!canvas || !contexto) return

    contexto.clearRect(0, 0, canvas.width, canvas.height)
    setTieneFirma(false)
    onChange(null)
  }

  useEffect(() => {
    const contexto = canvasRef.current?.getContext("2d")
    if (!contexto) return

    contexto.lineCap = "round"
    contexto.lineJoin = "round"
    contexto.lineWidth = 4
    contexto.strokeStyle = "#0f172a"
  }, [])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-black text-slate-950">{label}</p>
        <Button type="button" variant="outline" onClick={limpiar} className="h-9">
          Limpiar
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={720}
        height={220}
        className="h-36 w-full touch-none rounded-lg border border-dashed border-slate-300 bg-slate-50"
        onPointerDown={(evento) => {
          const canvas = canvasRef.current
          const contexto = canvas?.getContext("2d")
          if (!canvas || !contexto) return

          const punto = obtenerPunto(evento)
          dibujandoRef.current = true
          canvas.setPointerCapture(evento.pointerId)
          contexto.beginPath()
          contexto.moveTo(punto.x, punto.y)
        }}
        onPointerMove={(evento) => {
          if (!dibujandoRef.current) return

          const contexto = canvasRef.current?.getContext("2d")
          if (!contexto) return

          const punto = obtenerPunto(evento)
          contexto.lineTo(punto.x, punto.y)
          contexto.stroke()
          exportarFirma()
        }}
        onPointerUp={(evento) => {
          dibujandoRef.current = false
          canvasRef.current?.releasePointerCapture(evento.pointerId)
          exportarFirma()
        }}
        onPointerLeave={() => {
          dibujandoRef.current = false
        }}
      />
      <p className={`mt-2 text-sm font-semibold ${tieneFirma ? "text-emerald-700" : "text-slate-500"}`}>
        {tieneFirma ? "Firma capturada." : "Firme dentro del recuadro."}
      </p>
    </div>
  )
}
