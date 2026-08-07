"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  RefreshCw,
  ScanQrCode,
  Search,
  UserCheck,
  X,
} from "lucide-react"
import jsQR from "jsqr"
import { LanguageToggle } from "@/components/LanguageToggle"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"

type Asambleista = {
  id: string
  nombre: string
  credencial: string
  iglesia: string | null
  distrito: string | null
  metodo_voto: "electronico" | "manual"
  registrado: boolean
  pago_confirmado: boolean
  habilitado: boolean
  presente: boolean
  dispositivo_autorizado_id: string | null
  dispositivo_alerta_en: string | null
  dispositivo_alerta_detalle: string | null
}

function normalizarCredencial(valor: string) {
  return valor.trim().replace(/^VOTOAPP:/i, "").toUpperCase()
}

export default function PuertaPage() {
  const { t } = useI18n()
  const [asambleistas, setAsambleistas] = useState<Asambleista[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(25)
  const [seleccionado, setSeleccionado] = useState<Asambleista | null>(null)
  const [cargando, setCargando] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [modoEscaneo, setModoEscaneo] = useState<"entrada" | "salida">("entrada")
  const [mensajeEscaneo, setMensajeEscaneo] = useState("")
  const asambleistasRef = useRef<Asambleista[]>([])
  const procesandoEscaneoRef = useRef(false)
  const ultimoEscaneoRef = useRef({ credencial: "", instante: 0 })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)

  const cargarAsambleistas = useCallback(async () => {
    const res = await fetch("/api/oficina/asambleistas")
    const data = await res.json()

    if (!res.ok || !data.ok) {
      alert(data.error || t("No se pudo cargar la lista", "Could not load the list"))
      return
    }

    setAsambleistas(data.asambleistas || [])
  }, [t])

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

  useEffect(() => {
    asambleistasRef.current = asambleistas
  }, [asambleistas])

  const buscarPorCredencial = useCallback(
    (valor: string) => {
      const credencial = normalizarCredencial(valor)
      return asambleistasRef.current.find((a) => a.credencial.toUpperCase() === credencial) || null
    },
    []
  )

  const actualizarPresencia = useCallback(async (asambleista: Asambleista, presente: boolean) => {
    setCargando(true)

    try {
      const res = await fetch("/api/oficina/asambleistas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asambleista.id, cambios: { presente } }),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        alert(data.error || t("No se pudo actualizar la presencia", "Could not update attendance"))
        return
      }

      setSeleccionado(data.asambleista)
      setMensajeEscaneo(
        presente
          ? t(`${data.asambleista.nombre} marcado presente`, `${data.asambleista.nombre} marked present`)
          : t(`${data.asambleista.nombre} marcado fuera`, `${data.asambleista.nombre} marked out`)
      )
      await cargarAsambleistas()
    } catch {
      setMensajeEscaneo(t("No se pudo actualizar la presencia", "Could not update attendance"))
    } finally {
      setCargando(false)
    }
  }, [cargarAsambleistas, t])

  const procesarCredencialEscaneada = useCallback(async (valor: string) => {
    const credencial = normalizarCredencial(valor)
    const instante = Date.now()

    if (
      procesandoEscaneoRef.current ||
      (ultimoEscaneoRef.current.credencial === credencial &&
        instante - ultimoEscaneoRef.current.instante < 5000)
    ) {
      return
    }

    ultimoEscaneoRef.current = { credencial, instante }
    const encontrado = buscarPorCredencial(credencial)
    setBusqueda(credencial)
    setPagina(1)

    if (!encontrado) {
      setSeleccionado(null)
      setMensajeEscaneo(t(`No se encontró la credencial ${credencial}`, `Credential ${credencial} was not found`))
      return
    }

    setSeleccionado(encontrado)

    if (modoEscaneo === "entrada" && !encontrado.habilitado) {
      setMensajeEscaneo(t(
        `${encontrado.nombre} no está habilitado para entrar`,
        `${encontrado.nombre} is not approved for check-in`
      ))
      return
    }

    const presente = modoEscaneo === "entrada"

    if (encontrado.presente === presente) {
      setMensajeEscaneo(
        presente
          ? t(`${encontrado.nombre} ya está presente`, `${encontrado.nombre} is already present`)
          : t(`${encontrado.nombre} ya está fuera`, `${encontrado.nombre} is already out`)
      )
      return
    }

    procesandoEscaneoRef.current = true
    try {
      await actualizarPresencia(encontrado, presente)
    } finally {
      procesandoEscaneoRef.current = false
    }
  }, [actualizarPresencia, buscarPorCredencial, modoEscaneo, t])

  const iniciarEscaner = async () => {
    setMensajeEscaneo("")

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      const video = videoRef.current
      const canvas = canvasRef.current

      if (!video || !canvas) return

      streamRef.current = stream
      video.srcObject = stream
      await video.play()
      setEscaneando(true)

      const escanear = async () => {
        const videoActual = videoRef.current
        const canvasActual = canvasRef.current

        if (!videoActual || !canvasActual || !streamRef.current) return

        if (videoActual.readyState === videoActual.HAVE_ENOUGH_DATA) {
          const ancho = videoActual.videoWidth
          const alto = videoActual.videoHeight

          if (ancho > 0 && alto > 0) {
            canvasActual.width = ancho
            canvasActual.height = alto

            const contexto = canvasActual.getContext("2d", { willReadFrequently: true })

            if (contexto) {
              contexto.drawImage(videoActual, 0, 0, ancho, alto)
              const imagen = contexto.getImageData(0, 0, ancho, alto)
              const resultado = jsQR(imagen.data, imagen.width, imagen.height)

              if (resultado?.data) {
                void procesarCredencialEscaneada(resultado.data)
              }
            }
          }
        }

        frameRef.current = requestAnimationFrame(escanear)
      }

      frameRef.current = requestAnimationFrame(escanear)
    } catch {
      detenerEscaner()
      setMensajeEscaneo(t(
        "No se pudo abrir la cámara. Revisa permisos o usa la búsqueda manual.",
        "Could not open the camera. Check permissions or use manual search."
      ))
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

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaActual - 1) * porPagina
  const paginados = visibles.slice(inicioPagina, inicioPagina + porPagina)

  const resetearDispositivo = async (asambleista: Asambleista) => {
    if (
      !window.confirm(
        t(
          `¿Validar nuevamente el dispositivo para ${asambleista.nombre}? Se limpiará el dispositivo anterior y deberá entrar nuevamente.`,
          `Validate ${asambleista.nombre}'s device again? The previous device will be cleared and they must enter again.`
        )
      )
    ) {
      return
    }

    setCargando(true)

    const res = await fetch("/api/oficina/asambleistas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: asambleista.id, accion: "reset_dispositivo" }),
    })
    const data = await res.json()

    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || t("No se pudo validar nuevamente el dispositivo", "Could not validate the device again"))
      return
    }

    setSeleccionado(data.asambleista)
    setMensajeEscaneo(t(
      `${data.asambleista.nombre} puede entrar nuevamente desde su dispositivo validado`,
      `${data.asambleista.nombre} can enter again from the validated device`
    ))
    await cargarAsambleistas()
  }

  const resolverDispositivo = async (
    asambleista: Asambleista,
    accion: "mantener_dispositivo_actual" | "autorizar_dispositivo_intento"
  ) => {
    const mensaje =
      accion === "autorizar_dispositivo_intento"
        ? t(
            `¿Autorizar el nuevo dispositivo para ${asambleista.nombre}? El dispositivo anterior quedará bloqueado.`,
            `Authorize the new device for ${asambleista.nombre}? The previous device will be blocked.`
          )
        : t(
            `¿Mantener el dispositivo anterior para ${asambleista.nombre}? El dispositivo nuevo quedará bloqueado.`,
            `Keep the previous device for ${asambleista.nombre}? The new device will be blocked.`
          )

    if (!window.confirm(mensaje)) {
      return
    }

    setCargando(true)

    const res = await fetch("/api/oficina/asambleistas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: asambleista.id, accion }),
    })
    const data = await res.json()

    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || t("No se pudo resolver la validación del dispositivo", "Could not resolve device validation"))
      return
    }

    setSeleccionado(data.asambleista)
    setMensajeEscaneo(
      accion === "autorizar_dispositivo_intento"
        ? t(
            `${data.asambleista.nombre} puede entrar desde el nuevo dispositivo autorizado`,
            `${data.asambleista.nombre} can enter from the newly authorized device`
          )
        : t(
            `${data.asambleista.nombre} debe continuar desde el dispositivo anterior`,
            `${data.asambleista.nombre} must continue from the previous device`
          )
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
                {t("Puerta", "Door")}
              </p>
              <h1 className="mt-1 text-2xl font-black">Check-in / Check-out</h1>
              <p className="mt-1 text-sm text-white/70">{t("Escaneo rápido por QR o credencial.", "Fast scan by QR or credential.")}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <LanguageToggle className="border-white/20 bg-white/10 [&_button:not([aria-pressed=true])]:text-white/80 [&_button:not([aria-pressed=true])]:hover:bg-white/10 [&_button[aria-pressed=true]]:bg-white [&_button[aria-pressed=true]]:text-[#16382f]" />
              <Button
                type="button"
                onClick={cargarAsambleistas}
                variant="outline"
                className="h-11 rounded-xl border-white/20 bg-white/10 px-3 text-white hover:bg-white/20"
                aria-label={t("Actualizar lista", "Refresh list")}
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/65">Total</p>
              <p className="text-2xl font-black">{asambleistas.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/65">{t("Presentes", "Present")}</p>
              <p className="text-2xl font-black text-emerald-200">{presentes}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/65">{t("Habilitados", "Approved")}</p>
              <p className="text-2xl font-black text-[#d7c27a]">{habilitados}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 grid grid-cols-2 rounded-xl bg-slate-100 p-1" aria-label={t("Modo de escaneo", "Scan mode")}>
            <button
              type="button"
              aria-pressed={modoEscaneo === "entrada"}
              disabled={escaneando}
              onClick={() => {
                setModoEscaneo("entrada")
                ultimoEscaneoRef.current = { credencial: "", instante: 0 }
                setMensajeEscaneo("")
              }}
              className={`flex h-11 items-center justify-center gap-2 rounded-lg font-black transition disabled:cursor-not-allowed disabled:opacity-70 ${
                modoEscaneo === "entrada"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              <CheckCircle2 className="h-5 w-5" />
              {t("Entrada", "Check-in")}
            </button>
            <button
              type="button"
              aria-pressed={modoEscaneo === "salida"}
              disabled={escaneando}
              onClick={() => {
                setModoEscaneo("salida")
                ultimoEscaneoRef.current = { credencial: "", instante: 0 }
                setMensajeEscaneo("")
              }}
              className={`flex h-11 items-center justify-center gap-2 rounded-lg font-black transition disabled:cursor-not-allowed disabled:opacity-70 ${
                modoEscaneo === "salida"
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              <LogOut className="h-5 w-5" />
              {t("Salida", "Check-out")}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Search className="h-5 w-5 text-slate-500" />
              <input
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setPagina(1)
                  setSeleccionado(null)
                  setMensajeEscaneo("")
                }}
                placeholder={t("Nombre o credencial", "Name or credential")}
                className="w-full bg-transparent text-base font-semibold outline-none"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => {
                    setBusqueda("")
                    setPagina(1)
                    setSeleccionado(null)
                    setMensajeEscaneo("")
                  }}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  aria-label={t("Limpiar búsqueda", "Clear search")}
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
              {escaneando ? t("Detener", "Stop") : t("Escanear QR", "Scan QR")}
            </Button>
          </div>

          <div className={escaneando ? "mt-4 overflow-hidden rounded-2xl bg-slate-950" : "hidden"}>
            <video
              ref={videoRef}
              className="h-72 w-full object-cover"
              muted
              playsInline
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {mensajeEscaneo && (
            <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-bold text-slate-700">
              {mensajeEscaneo}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
              {t("Mostrar", "Show")}
              <select
                value={porPagina}
                onChange={(e) => {
                  setPorPagina(Number(e.target.value))
                  setPagina(1)
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-black text-slate-900"
              >
                {[25, 50, 75, 100, 125, 150, 175].map((cantidad) => (
                  <option key={cantidad} value={cantidad}>{cantidad}</option>
                ))}
              </select>
            </label>

            <p className="text-sm font-semibold text-slate-500">
              {visibles.length === 0
                ? t("0 registros", "0 records")
                : t(
                    `${inicioPagina + 1}-${Math.min(inicioPagina + porPagina, visibles.length)} de ${visibles.length}`,
                    `${inicioPagina + 1}-${Math.min(inicioPagina + porPagina, visibles.length)} of ${visibles.length}`
                  )}
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={paginaActual === 1}
                onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                aria-label={t("Página anterior", "Previous page")}
                title={t("Página anterior", "Previous page")}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="min-w-20 text-center text-sm font-black text-slate-700">
                {paginaActual} / {totalPaginas}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
                aria-label={t("Página siguiente", "Next page")}
                title={t("Página siguiente", "Next page")}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500 shadow-sm">
              {t("No hay registros para mostrar.", "No records to show.")}
            </p>
          ) : (
            paginados.map((a) => {
              const abierto = seleccionado?.id === a.id
              const actual = abierto && seleccionado ? seleccionado : a

              return (
                <article
                  key={a.id}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                    abierto ? "border-emerald-200 ring-1 ring-emerald-100" : "border-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={abierto}
                    onClick={() => {
                      setSeleccionado(abierto ? null : a)
                      setMensajeEscaneo("")
                    }}
                    className="w-full p-4 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <UserCheck className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-lg font-black text-slate-950">{actual.nombre}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-500">
                              {actual.credencial} · {actual.iglesia || "N/A"} · {actual.distrito || "N/A"}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                              actual.presente ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                            }`}
                          >
                            {actual.presente ? t("Presente", "Present") : t("Fuera", "Out")}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-400">
                          {actual.habilitado ? t("Habilitado", "Approved") : t("No habilitado", "Not approved")} ·{" "}
                          {actual.metodo_voto === "manual" ? t("Voto manual", "Manual vote") : t("Voto electrónico", "Electronic vote")}
                        </p>
                      </div>
                    </div>
                  </button>

                  {abierto && (
                    <div className="border-t border-slate-100 p-4 pt-3">
                      {actual.dispositivo_alerta_en && (
                        <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
                          {t(
                            "Alerta: esta credencial fue usada desde otro dispositivo. Verifica la identidad antes de validarla nuevamente.",
                            "Alert: this credential was used from another device. Verify identity before validating it again."
                          )}
                        </p>
                      )}
                      {actual.dispositivo_autorizado_id && !actual.dispositivo_alerta_en && (
                        <p className="mb-3 rounded-xl bg-indigo-50 p-3 text-sm font-bold text-indigo-700">
                          {t("Esta credencial ya tiene un dispositivo autorizado.", "This credential already has an authorized device.")}
                        </p>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                          disabled={cargando || actual.presente || !actual.habilitado}
                          onClick={() => actualizarPresencia(actual, true)}
                          className="h-14 rounded-xl bg-emerald-600 text-base font-black hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="mr-2 h-5 w-5" />
                          Check-in
                        </Button>
                        <Button
                          disabled={cargando || !actual.presente}
                          onClick={() => actualizarPresencia(actual, false)}
                          className="h-14 rounded-xl bg-red-600 text-base font-black hover:bg-red-700"
                        >
                          <LogOut className="mr-2 h-5 w-5" />
                          Check-out
                        </Button>

                        {actual.dispositivo_alerta_en ? (
                          <>
                            <Button
                              disabled={cargando}
                              onClick={() => resolverDispositivo(actual, "mantener_dispositivo_actual")}
                              className="h-14 rounded-xl bg-slate-700 text-base font-black hover:bg-slate-800"
                            >
                              {t("Mantener anterior", "Keep previous")}
                            </Button>
                            <Button
                              disabled={cargando}
                              onClick={() => resolverDispositivo(actual, "autorizar_dispositivo_intento")}
                              className="h-14 rounded-xl bg-amber-600 text-base font-black hover:bg-amber-700"
                            >
                              {t("Autorizar nuevo", "Authorize new")}
                            </Button>
                          </>
                        ) : actual.dispositivo_autorizado_id ? (
                          <Button
                            disabled={cargando}
                            onClick={() => resetearDispositivo(actual)}
                            className="h-14 rounded-xl bg-amber-600 text-base font-black hover:bg-amber-700 sm:col-span-2"
                          >
                            {t("Liberar dispositivo", "Release device")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </article>
              )
            })
          )}
        </section>
      </div>
    </main>
  )
}
