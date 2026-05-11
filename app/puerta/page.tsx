"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  LogOut,
  RefreshCw,
  ScanQrCode,
  Search,
  UserCheck,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type Asambleista = {
  id: string
  nombre: string
  credencial: string
  iglesia: string | null
  distrito: string | null
  registrado: boolean
  pago_confirmado: boolean
  habilitado: boolean
  presente: boolean
}

type BarcodeResult = {
  rawValue?: string
}

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]>
}

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[]
}) => BarcodeDetectorInstance

function normalizarCredencial(valor: string) {
  return valor.trim().replace(/^VOTOAPP:/i, "").toUpperCase()
}

export default function PuertaPage() {
  const [asambleistas, setAsambleistas] = useState<Asambleista[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [seleccionado, setSeleccionado] = useState<Asambleista | null>(null)
  const [cargando, setCargando] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [mensajeEscaneo, setMensajeEscaneo] = useState("")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)

  const cargarAsambleistas = useCallback(async () => {
    const res = await fetch("/api/oficina/asambleistas")
    const data = await res.json()

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudo cargar la lista")
      return
    }

    setAsambleistas(data.asambleistas || [])
  }, [])

  const detenerEscaner = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setEscaneando(false)
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarAsambleistas()
    })

    return () => detenerEscaner()
  }, [cargarAsambleistas, detenerEscaner])

  const buscarPorCredencial = useCallback(
    (valor: string) => {
      const credencial = normalizarCredencial(valor)
      return asambleistas.find((a) => a.credencial.toUpperCase() === credencial) || null
    },
    [asambleistas]
  )

  const seleccionarPorCredencial = useCallback(
    (valor: string) => {
      const credencial = normalizarCredencial(valor)
      const encontrado = buscarPorCredencial(credencial)
      setBusqueda(credencial)

      if (!encontrado) {
        setSeleccionado(null)
        setMensajeEscaneo(`No se encontró la credencial ${credencial}`)
        return
      }

      setSeleccionado(encontrado)
      setMensajeEscaneo(`${encontrado.nombre} listo para validar`)
    },
    [buscarPorCredencial]
  )

  const iniciarEscaner = async () => {
    setMensajeEscaneo("")

    if (!("BarcodeDetector" in window)) {
      setMensajeEscaneo("Este navegador no permite escanear QR aquí. Usa la búsqueda por credencial.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      const video = videoRef.current

      if (!video) return

      streamRef.current = stream
      video.srcObject = stream
      await video.play()
      setEscaneando(true)

      const Detector = window.BarcodeDetector as BarcodeDetectorConstructor
      const detector = new Detector({ formats: ["qr_code"] })

      const escanear = async () => {
        if (!videoRef.current || !streamRef.current) return

        try {
          const resultados = await detector.detect(videoRef.current)
          const valor = resultados[0]?.rawValue

          if (valor) {
            detenerEscaner()
            seleccionarPorCredencial(valor)
            return
          }
        } catch {
          setMensajeEscaneo("No se pudo leer el QR. Intenta acercar o mejorar la luz.")
        }

        frameRef.current = requestAnimationFrame(escanear)
      }

      frameRef.current = requestAnimationFrame(escanear)
    } catch {
      detenerEscaner()
      setMensajeEscaneo("No se pudo abrir la cámara. Revisa permisos o usa la búsqueda manual.")
    }
  }

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return asambleistas

    return asambleistas.filter((a) =>
      [a.nombre, a.credencial, a.iglesia || "", a.distrito || ""]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    )
  }, [asambleistas, busqueda])

  const actualizarPresencia = async (asambleista: Asambleista, presente: boolean) => {
    setCargando(true)

    const res = await fetch("/api/oficina/asambleistas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: asambleista.id, cambios: { presente } }),
    })
    const data = await res.json()

    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudo actualizar la presencia")
      return
    }

    setSeleccionado(data.asambleista)
    setMensajeEscaneo(
      presente
        ? `${data.asambleista.nombre} marcado presente`
        : `${data.asambleista.nombre} marcado fuera`
    )
    await cargarAsambleistas()
  }

  const presentes = asambleistas.filter((a) => a.presente).length
  const habilitados = asambleistas.filter((a) => a.habilitado).length

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-2xl bg-[#16382f] p-5 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7c27a]">
                Puerta
              </p>
              <h1 className="mt-1 text-2xl font-black">Check-in / Check-out</h1>
              <p className="mt-1 text-sm text-white/70">Escaneo rápido por QR o credencial.</p>
            </div>
            <Button
              type="button"
              onClick={cargarAsambleistas}
              variant="outline"
              className="h-11 rounded-xl border-white/20 bg-white/10 px-3 text-white hover:bg-white/20"
              aria-label="Actualizar lista"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/65">Total</p>
              <p className="text-2xl font-black">{asambleistas.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/65">Presentes</p>
              <p className="text-2xl font-black text-emerald-200">{presentes}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/65">Habilitados</p>
              <p className="text-2xl font-black text-[#d7c27a]">{habilitados}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Search className="h-5 w-5 text-slate-500" />
              <input
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setSeleccionado(null)
                  setMensajeEscaneo("")
                }}
                placeholder="Nombre o credencial"
                className="w-full bg-transparent text-base font-semibold outline-none"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => {
                    setBusqueda("")
                    setSeleccionado(null)
                    setMensajeEscaneo("")
                  }}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Button
              type="button"
              onClick={escaneando ? detenerEscaner : iniciarEscaner}
              className="h-12 rounded-xl bg-[#16382f] px-5 font-black hover:bg-[#0f2b24]"
            >
              <ScanQrCode className="mr-2 h-5 w-5" />
              {escaneando ? "Detener" : "Escanear QR"}
            </Button>
          </div>

          <div className={escaneando ? "mt-4 overflow-hidden rounded-2xl bg-slate-950" : "hidden"}>
            <video
              ref={videoRef}
              className="h-72 w-full object-cover"
              muted
              playsInline
            />
          </div>

          {mensajeEscaneo && (
            <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-700">
              {mensajeEscaneo}
            </p>
          )}
        </section>

        {seleccionado && (
          <section className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <UserCheck className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-black text-slate-950">{seleccionado.nombre}</p>
                <p className="text-sm font-semibold text-slate-500">
                  {seleccionado.credencial} · {seleccionado.iglesia || "N/A"} ·{" "}
                  {seleccionado.distrito || "N/A"}
                </p>
                <p
                  className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${
                    seleccionado.presente
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {seleccionado.presente ? "PRESENTE" : "FUERA"} ·{" "}
                  {seleccionado.habilitado ? "HABILITADO" : "NO HABILITADO"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button
                disabled={cargando || seleccionado.presente || !seleccionado.habilitado}
                onClick={() => actualizarPresencia(seleccionado, true)}
                className="h-14 rounded-xl bg-emerald-600 text-base font-black hover:bg-emerald-700"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Check-in
              </Button>

              <Button
                disabled={cargando || !seleccionado.presente}
                onClick={() => actualizarPresencia(seleccionado, false)}
                className="h-14 rounded-xl bg-red-600 text-base font-black hover:bg-red-700"
              >
                <LogOut className="mr-2 h-5 w-5" />
                Check-out
              </Button>
            </div>
          </section>
        )}

        <section className="space-y-3">
          {visibles.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500 shadow-sm">
              No hay registros para mostrar.
            </p>
          ) : (
            visibles.slice(0, 20).map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => {
                  setSeleccionado(a)
                  setMensajeEscaneo("")
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#c8a957]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black text-slate-950">{a.nombre}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {a.credencial} · {a.iglesia || "N/A"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                      a.presente ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {a.presente ? "Presente" : "Fuera"}
                  </span>
                </div>
              </button>
            ))
          )}
        </section>
      </div>
    </main>
  )
}
