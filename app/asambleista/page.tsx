"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { LanguageToggle } from "@/components/LanguageToggle"
import { Button } from "@/components/ui/button"
import { useAsamblea } from "@/hooks/useAsamblea"
import { useVotacion } from "@/hooks/useVotacion"
import { hacerCheckin, hacerCheckinAutomatico } from "@/lib/checkinApi"
import { enviarVoto } from "@/lib/voteApi"
import { fetchConTimeout } from "@/lib/fetchConTimeout"
import { getDeviceId } from "@/lib/deviceId"
import { useI18n } from "@/lib/i18n"
import { supabase } from "@/lib/supabaseClient"
import {
  Check,
  LoaderCircle,
  WifiOff,
  X,
  ShieldCheck,
} from "lucide-react"

import {
  mostrarTipoMayoria,
  mostrarTipoVotacion,
  mostrarTipoMocion,
  claseRanking,
} from "@/lib/votacionHelpers"

const MENSAJES_VOTO: Record<string, string> = {
  YA_VOTO: "Ya registraste tu voto en esta votación",
  TOKEN_INVALIDO: "Tu sesión no es válida, vuelve a hacer check-in",
  VOTACION_CERRADA: "La votación ya fue cerrada",
  ASAMBLEA_RECESO: "La asamblea está en receso. Espera a que se reanuden los trabajos.",
  ASAMBLEISTA_INVALIDO: "No se pudo validar tu registro de asambleísta",
  NO_HABILITADO: "No estás habilitado para votar. Pasa por la mesa de registro.",
  NO_PRESENTE: "No puedes votar porque ya no figuras presente en la asamblea.",
  VOTO_MANUAL:
    "Tu participación fue cambiada a voto manual. Pasa por la mesa para recibir tu balota.",
  DISPOSITIVO_NO_AUTORIZADO:
    "Esta credencial requiere validación nuevamente. Pase por la mesa de registro.",
  DISPOSITIVO_REVALIDACION_REQUERIDA:
    "Esta credencial requiere validación nuevamente. Pase por la mesa de registro.",
  OPCION_INVALIDA: "La opción seleccionada no es válida para esta votación",
  CANDIDATO_REQUERIDO: "Selecciona un candidato para votar",
  CANDIDATO_INVALIDO: "El candidato seleccionado no pertenece a esta votación",
  CANDIDATO_NO_APLICA: "Esta votación no acepta candidatos",
  OPCION_NO_APLICA: "Esta votación requiere seleccionar un candidato",
  TIEMPO_AGOTADO: "La red tardó demasiado. Verifica tu conexión e inténtalo de nuevo.",
  SIN_CONEXION: "No hay conexión. Revisa tu señal e inténtalo de nuevo.",
  DEMASIADOS_INTENTOS: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
}

const MENSAJES_NOMINACION: Record<string, string> = {
  YA_VOTO: "Ya registraste tu voto en esta votacion",
  TOKEN_INVALIDO: "Tu sesión no es válida, vuelve a hacer check-in",
  NO_HABILITADO: "No estás habilitado para nominar. Pasa por la mesa de registro.",
  NO_PRESENTE: "No puedes nominar porque no figuras presente en la asamblea.",
  VOTO_MANUAL:
    "Tu participación fue cambiada a voto manual. Pasa por la mesa para recibir tu balota.",
  VOTACION_INVALIDA: "No hay una elección de líderes abierta para nominar",
  NOMINACION_CERRADA: "Las nominaciones para esta ronda ya fueron cerradas",
  ASAMBLEA_RECESO: "La asamblea está en receso. Espera a que se reanuden los trabajos.",
  DISPOSITIVO_REVALIDACION_REQUERIDA:
    "Esta credencial requiere validación nuevamente. Pase por la mesa de registro.",
  TIEMPO_AGOTADO: "La red tardó demasiado. Verifica tu conexión e inténtalo de nuevo.",
  SIN_CONEXION: "No hay conexión. Revisa tu señal e inténtalo de nuevo.",
  DEMASIADOS_INTENTOS: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
}

function obtenerOrganizacionDesdeNavegador(fallback: string) {
  if (typeof window === "undefined") return fallback

  const orgUrl = new URLSearchParams(window.location.search).get("org")?.trim()

  if (orgUrl) {
    localStorage.setItem("organizacion_slug", orgUrl)
    return orgUrl
  }

  return localStorage.getItem("organizacion_slug") || fallback
}

export default function AsambleistaPage() {
  const { t } = useI18n()
  const { asambleaId, anioAsamblea, lugarAsamblea, organizacionAsamblea, estadoAsamblea, organizacionSlugSesion } =
    useAsamblea()
  const [asambleaIdAcceso, setAsambleaIdAcceso] = useState("")
  const asambleaActivaId = asambleaIdAcceso || asambleaId

  const {
    estado,
    votacionId,
    titulo,
    tipoMayoria,
    tipoVotacion,
    tipoMocion,
    rondaNumero,
    conteoCandidatos,
    yaVoto,
    setYaVoto,
    sesionExpirada,
    setSesionExpirada,
    asambleaEstado,
    cargarVotacionActiva,
  } = useVotacion(asambleaActivaId, {
    ocultarCandidatosPrimeraRonda: true,
    modoAsambleista: true,
  })

  // token ahora almacena el token_hash (retornado por /api/checkin)
  const [token, setToken] = useState("")
  const [asambleistaId, setAsambleistaId] = useState("")
  const [asambleistaNombre, setAsambleistaNombre] = useState("")
  const [credencial, setCredencial] = useState("")
  const [nominacion, setNominacion] = useState("")
  const [cargando, setCargando] = useState(false)
  const [enLinea, setEnLinea] = useState(true)
  const [aviso, setAviso] = useState("")
  const guardarAcceso = useCallback((resultado: {
    token?: string
    asamblea?: { id?: string }
    asambleista?: { id?: string; nombre?: string }
  }) => {
    localStorage.setItem("token_votacion", resultado.token || "")
    localStorage.setItem("asambleista_id", resultado.asambleista?.id || "")
    localStorage.setItem("asambleista_nombre", resultado.asambleista?.nombre || "")
    localStorage.setItem("asamblea_id", resultado.asamblea?.id || "")
    setToken(resultado.token || "")
    setAsambleistaId(resultado.asambleista?.id || "")
    setAsambleistaNombre(resultado.asambleista?.nombre || "")
    setAsambleaIdAcceso(resultado.asamblea?.id || "")
  }, [])

  const bloquearSesionPorRevalidacion = useCallback(() => {
    localStorage.removeItem("token_votacion")
    localStorage.removeItem("asambleista_id")
    localStorage.removeItem("asambleista_nombre")
    localStorage.removeItem("asamblea_id")
    setToken("")
    setAsambleistaId("")
    setAsambleistaNombre("")
    setAsambleaIdAcceso("")
    setYaVoto(false)
  }, [setYaVoto])

  const cerrarSesionManual = useCallback(() => {
    bloquearSesionPorRevalidacion()
    setSesionExpirada(false)
    setAviso(t("Sesión cerrada.", "Session closed."))
  }, [bloquearSesionPorRevalidacion, setSesionExpirada, t])

  // Si el token expira o es invalidado, limpiamos la sesión y mostramos de nuevo
  // el check-in en vez de dejar el dispositivo atascado en "Acreditado".
  useEffect(() => {
    if (!sesionExpirada) return

    queueMicrotask(() => {
      bloquearSesionPorRevalidacion()
      setSesionExpirada(false)
      setAviso(
        t(
          "Tu sesión expiró. Vuelve a hacer check-in con tu credencial.",
          "Your session expired. Please check in again with your credential."
        )
      )
    })
  }, [sesionExpirada, bloquearSesionPorRevalidacion, setSesionExpirada, t])

  // Estado de asamblea visible para el votante: /api/asambleas exige sesión de
  // administrador (siempre 401 en el dispositivo del votante), así que tomamos
  // el estado que expone /api/votacion-activa y solo caemos al de useAsamblea.
  const estadoAsambleaVisible = asambleaEstado ?? estadoAsamblea

  useEffect(() => {
    queueMicrotask(() => {
      setToken(localStorage.getItem("token_votacion") || "")
      setAsambleistaId(localStorage.getItem("asambleista_id") || "")
      setAsambleistaNombre(localStorage.getItem("asambleista_nombre") || "")
      setAsambleaIdAcceso(localStorage.getItem("asamblea_id") || "")
    })
  }, [])

  useEffect(() => {
    const conectar = () => {
      setEnLinea(true)
      void cargarVotacionActiva()
    }
    const desconectar = () => setEnLinea(false)

    queueMicrotask(() => setEnLinea(navigator.onLine))
    window.addEventListener("online", conectar)
    window.addEventListener("offline", desconectar)

    return () => {
      window.removeEventListener("online", conectar)
      window.removeEventListener("offline", desconectar)
    }
  }, [cargarVotacionActiva])

  useEffect(() => {
    if (token) return

    const accessToken = new URLSearchParams(window.location.search).get("access")?.trim()
    if (!accessToken) return

    let cancelado = false
    let reintento: ReturnType<typeof setTimeout> | null = null

    const intentarAcceso = async () => {
      const resultado = await hacerCheckinAutomatico(
        accessToken,
        getDeviceId(),
        obtenerOrganizacionDesdeNavegador(organizacionSlugSesion)
      )

      if (cancelado) return

      if (!resultado.ok) {
        if (resultado.error === "PENDIENTE_CHECKIN_PRESENCIAL") {
          setAviso(
            t(
              "Identidad confirmada. Pendiente de check-in presencial en Puerta.",
              "Identity confirmed. Waiting for in-person check-in at the door."
            )
          )
          reintento = setTimeout(() => void intentarAcceso(), 5000)
          return
        }

        const mensajes: Record<string, string> = {
          TOKEN_ACCESO_INVALIDO: "El enlace de acceso no es valido. Usa tu credencial o pasa por registro.",
          TOKEN_ACCESO_EXPIRADO: "El enlace de acceso expiro. Pasa por registro para reenviar la credencial.",
          NO_HAY_ASAMBLEA: "No hay una asamblea activa en este momento",
          NO_EXISTE: "Credencial no encontrada",
          NO_HABILITADO:
            "No estas habilitado para hacer check-in. Pasa primero por la mesa de registro.",
          VOTO_MANUAL:
            "Tu participacion esta registrada para voto manual. Pasa por la mesa para recibir tu balota.",
          DISPOSITIVO_REVALIDACION_REQUERIDA:
            "Esta credencial requiere validacion nuevamente. Pase por la mesa de registro.",
          ASAMBLEA_NO_AUTORIZADA:
            "Este enlace no pertenece a la organizacion seleccionada.",
          DEMASIADOS_INTENTOS: "Demasiados intentos. Espera un momento e intentalo de nuevo.",
          TIEMPO_AGOTADO: "La red tardo demasiado. Verifica tu conexion e intentalo de nuevo.",
          SIN_CONEXION: "No hay conexion. Revisa tu senal e intentalo de nuevo.",
          ERROR_TOKEN: "Error al generar el token, intenta de nuevo",
          ERROR_SERVIDOR: "Error del servidor, intenta de nuevo",
        }
        setAviso(t(mensajes[resultado.error] || "No se pudo validar el enlace", "Could not validate link"))
        return
      }

      guardarAcceso(resultado)
      setAviso(t("Check-in confirmado. Acceso concedido.", "Check-in confirmed. Access granted."))
      await cargarVotacionActiva()
    }

    void intentarAcceso()

    return () => {
      cancelado = true
      if (reintento) clearTimeout(reintento)
    }
  }, [cargarVotacionActiva, guardarAcceso, organizacionSlugSesion, t, token])

  useEffect(() => {
    if (!token || !asambleistaId) return

    const canal = supabase
      .channel(`asambleista-device-alert-${asambleistaId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "asambleistas",
          filter: `id=eq.${asambleistaId}`,
        },
        (payload) => {
          if (payload.new?.presente === false) {
            bloquearSesionPorRevalidacion()
            setAviso(t("Tu check-out fue registrado.", "Your check-out was recorded."))
            return
          }

          if (!payload.new?.dispositivo_alerta_en) return

          bloquearSesionPorRevalidacion()
          setAviso(
            t(
              "Esta credencial requiere validación nuevamente. Pase por la mesa de registro.",
              "This credential requires validation again. Please go to the registration desk."
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [asambleistaId, bloquearSesionPorRevalidacion, token, t])

  // Bug #3 corregido: usa /api/checkin que retorna token_hash
  const handleCheckIn = async () => {
    if (!credencial) {
      setAviso(t("Ingresa una credencial válida", "Enter a valid credential"))
      return
    }

    setCargando(true)

    try {
      const resultado = await hacerCheckin(
        credencial.trim().toUpperCase(),
        getDeviceId(),
        obtenerOrganizacionDesdeNavegador(organizacionSlugSesion)
      )

      if (!resultado.ok) {
        const mensajes: Record<string, string> = {
          FALTA_CREDENCIAL: "Ingresa una credencial válida",
          NO_HAY_ASAMBLEA: "No hay una asamblea activa en este momento",
          NO_EXISTE: "Credencial no encontrada",
          NO_HABILITADO:
            "No estás habilitado para hacer check-in. Pasa primero por la mesa de registro.",
          VOTO_MANUAL:
            "Tu participación está registrada para voto manual. Pasa por la mesa para recibir tu balota.",
          PENDIENTE_CHECKIN_PRESENCIAL:
            "Identidad confirmada. Debes completar el check-in presencial en Puerta.",
          DISPOSITIVO_NO_AUTORIZADO:
            "Esta credencial requiere validación nuevamente. Pase por la mesa de registro.",
          DISPOSITIVO_REVALIDACION_REQUERIDA:
            "Esta credencial requiere validación nuevamente. Pase por la mesa de registro.",
          TIEMPO_AGOTADO: "La red tardó demasiado. Verifica tu conexión e inténtalo de nuevo.",
          SIN_CONEXION: "No hay conexión. Revisa tu señal e inténtalo de nuevo.",
          DEMASIADOS_INTENTOS: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
          ERROR_TOKEN: "Error al generar el token, intenta de nuevo",
          ERROR_SERVIDOR: "Error del servidor, intenta de nuevo",
        }
        setAviso(t(mensajes[resultado.error] || "Credencial inválida", "Invalid credential"))
        return
      }

      // Guardamos el token_hash, que es lo que espera la RPC registrar_voto
      guardarAcceso(resultado)
      setAviso(t("Acceso concedido", "Access granted"))
      await cargarVotacionActiva()
    } finally {
      setCargando(false)
    }
  }

  // Bug #3 corregido: usa /api/vote que llama a la RPC con token_hash
  const votarResolucion = async (opcion: "favor" | "contra") => {
    if (!token || !votacionId) {
      setAviso(t("Debes hacer check-in antes de votar", "You must check in before voting"))
      return
    }

    setCargando(true)

    try {
      const resultado = await enviarVoto({
        token,
        votacionId,
        opcion,
        deviceId: getDeviceId(),
      })

      if (!resultado.ok) {
        setAviso(
          t(
            MENSAJES_VOTO[resultado.code] || `No se pudo registrar el voto: ${resultado.code}`,
            MENSAJES_VOTO[resultado.code] || `Could not register vote: ${resultado.code}`
          )
        )
        if (resultado.code === "DISPOSITIVO_REVALIDACION_REQUERIDA") bloquearSesionPorRevalidacion()
        if (resultado.code === "YA_VOTO") setYaVoto(true)
        return
      }

      setYaVoto(true)
      await cargarVotacionActiva()
      setAviso(t("Voto registrado", "Vote registered"))
    } finally {
      setCargando(false)
    }
  }

  const nominarCandidato = async () => {
    if (!token || !votacionId) {
      setAviso(t("Debes hacer check-in antes de nominar", "You must check in before nominating"))
      return
    }

    if (!nominacion.trim()) {
      setAviso(t("Escribe el nombre de la persona nominada", "Enter the nominee name"))
      return
    }

    setCargando(true)

    try {
      const resultado = await fetchConTimeout("/api/nominaciones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          votacionId,
          nombre: nominacion,
          deviceId: getDeviceId(),
        }),
      })

      if (!resultado.ok) {
        const codigoRed = resultado.motivo === "timeout" ? "TIEMPO_AGOTADO" : "SIN_CONEXION"
        setAviso(t(MENSAJES_NOMINACION[codigoRed], MENSAJES_NOMINACION[codigoRed]))
        return
      }

      const data = await resultado.res.json().catch(() => null)

      if (!resultado.res.ok || !data?.ok) {
        const codigo = data?.error || "ERROR_NOMINACION"
        setAviso(
          t(
            MENSAJES_NOMINACION[codigo] || "No se pudo registrar la nominación",
            MENSAJES_NOMINACION[codigo] || "Could not register nomination"
          )
        )
        if (codigo === "DISPOSITIVO_REVALIDACION_REQUERIDA") bloquearSesionPorRevalidacion()
        if (codigo === "YA_VOTO") setYaVoto(true)
        return
      }

      setNominacion("")
      setYaVoto(true)
      await cargarVotacionActiva()
      setAviso(
        data.duplicado
          ? t("Voto de primera ronda registrado", "First-round vote registered")
          : t("Nominacion y voto registrados", "Nomination and vote registered")
      )
    } finally {
      setCargando(false)
    }
  }

  const votarCandidato = async (candidatoId: string) => {
    if (!token || !votacionId) {
      setAviso(t("Debes hacer check-in antes de votar", "You must check in before voting"))
      return
    }

    setCargando(true)

    try {
      const resultado = await enviarVoto({
        token,
        votacionId,
        candidatoId,
        deviceId: getDeviceId(),
      })

      if (!resultado.ok) {
        setAviso(
          t(
            MENSAJES_VOTO[resultado.code] || `No se pudo registrar el voto: ${resultado.code}`,
            MENSAJES_VOTO[resultado.code] || `Could not register vote: ${resultado.code}`
          )
        )
        if (resultado.code === "DISPOSITIVO_REVALIDACION_REQUERIDA") bloquearSesionPorRevalidacion()
        if (resultado.code === "YA_VOTO") setYaVoto(true)
        return
      }

      setYaVoto(true)
      await cargarVotacionActiva()
      setAviso(t("Voto registrado", "Vote registered"))
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="flex min-h-screen justify-center bg-[#f4f6f1] px-4 py-5 pb-28">
      {aviso && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed left-4 right-4 top-4 z-[60] mx-auto flex max-w-sm items-start gap-3 rounded-xl bg-[#102f28] p-4 text-sm font-bold text-white shadow-xl"
        >
          <span className="flex-1">{aviso}</span>
          <button type="button" onClick={() => setAviso("")} aria-label={t("Cerrar aviso", "Close notice")}>
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {!enLinea && (
        <div className="fixed bottom-24 left-4 right-4 z-[60] mx-auto flex max-w-sm items-center justify-center gap-2 rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900 shadow-lg">
          <WifiOff className="h-5 w-5" />
          {t("Sin conexión. Reconectando…", "Offline. Reconnecting…")}
        </div>
      )}

      {cargando && (
        <div className="fixed bottom-24 left-4 right-4 z-[59] mx-auto flex max-w-xs items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          {t("Procesando…", "Processing…")}
        </div>
      )}

      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <section className="bg-[#16382f] px-5 pb-16 pt-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src="/logo_voto_electronico.png"
                alt="Logo oficial"
                width={72}
                height={72}
                priority
                className="size-14 rounded-lg bg-white object-cover shadow-sm"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7c27a]">
                  Voto electrónico
                </p>
                <h1 className="mt-1 truncate text-lg font-black">
                {asambleaActivaId
                  ? organizacionAsamblea || `Asamblea ${anioAsamblea}`
                  : "Sin asamblea activa"}
              </h1>
              <p className="truncate text-sm text-white/68">
                {asambleaId ? `Asamblea ${anioAsamblea} · ${lugarAsamblea}` : "No iniciada"}
              </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <LanguageToggle className="border-white/20 bg-white/10 [&_button:not([aria-pressed=true])]:text-white/80 [&_button:not([aria-pressed=true])]:hover:bg-white/10 [&_button[aria-pressed=true]]:bg-white [&_button[aria-pressed=true]]:text-[#16382f]" />
              <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
                {token ? t("Acreditado", "Checked in") : t("Acceso", "Access")}
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#d7c27a]">
              {t("Participación", "Participation")}
            </p>
            <p className="mt-2 text-3xl font-black leading-tight">
              {t("Vota de forma clara, rápida y segura", "Vote clearly, quickly, and securely")}
            </p>
          </div>
        </section>

        <section className="-mt-10 space-y-4 px-4 pb-5">
          {!token && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">
                {t("Check-in de asambleísta", "Assembly member check-in")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t(
                  "Ingresa tu credencial para habilitar esta sesión de votación.",
                  "Enter your credential to enable this voting session."
                )}
              </p>

              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  enterKeyHint="go"
                  placeholder={t("Ej: A001", "Ex: A001")}
                  value={credencial}
                  onChange={(e) => setCredencial(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleCheckIn()}
                  className="h-12 w-full rounded-lg border border-slate-200 px-4 text-lg font-bold uppercase outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
                />
                <Button
                  onClick={handleCheckIn}
                  disabled={cargando || !enLinea}
                  className="h-12 rounded-lg bg-[#16382f] px-5 font-bold hover:bg-[#0f2b24]"
                >
                  {cargando ? "..." : t("Entrar", "Enter")}
                </Button>
              </div>
            </div>
          )}

          {token && asambleistaNombre && (
            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                    {t("Sesión acreditada", "Session checked in")}
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-950">
                    {asambleistaNombre}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cerrarSesionManual}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  {t("Salir", "Sign out")}
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {t(
                  "Tu identidad confirma acceso a la sesión; tu voto permanece secreto.",
                  "Your identity confirms session access; your vote remains secret."
                )}
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`mb-5 flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-black tracking-wide ${
              estadoAsambleaVisible === "receso"
                ? "bg-amber-50 text-amber-700"
                : estado === "abierta"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}>
              <span className={`size-2.5 rounded-full ${estado === "abierta" && estadoAsambleaVisible !== "receso" ? "bg-emerald-500" : "bg-amber-500"}`} />
              {estadoAsambleaVisible === "receso"
                ? t("ASAMBLEA EN RECESO", "ASSEMBLY IN RECESS")
                : estado === "abierta"
                  ? t("VOTACIÓN ACTIVA", "ACTIVE VOTE")
                  : t("EN ESPERA", "WAITING")}
            </div>

            <h2 className="text-center text-2xl font-black leading-tight text-slate-950">
              {titulo || t("Sin votación activa", "No active vote")}
            </h2>

            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-700">
                {mostrarTipoVotacion(tipoVotacion)}
              </p>

              {tipoVotacion === "resolucion" && (
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {mostrarTipoMocion(tipoMocion)}
                </p>
              )}

              <p className="mt-1 text-sm text-slate-500">
                {t("Mayoría requerida", "Required majority")}: {mostrarTipoMayoria(tipoMayoria)}
              </p>
            </div>

            {!token && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm font-bold text-red-700">
                {t("Debes hacer check-in antes de votar.", "You must check in before voting.")}
              </p>
            )}

            {estadoAsambleaVisible === "receso" && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-center text-sm font-bold text-amber-700">
                {t(
                  "La asamblea está en receso. La votación continuará cuando el moderador reanude los trabajos.",
                  "The assembly is in recess. Voting will continue when the moderator resumes the session."
                )}
              </p>
            )}

            {yaVoto && (
              <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700">
                {t("Tu voto ya fue registrado.", "Your vote has already been registered.")}
              </p>
            )}

            {estado === "cerrada" && titulo && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-center text-sm font-bold text-amber-700">
                {t("La votación ha sido cerrada.", "Voting has been closed.")}
              </p>
            )}

            {tipoVotacion === "resolucion" && estado === "abierta" && estadoAsambleaVisible !== "receso" && (
              <div className="mt-5 space-y-3">
                <Button
                  onClick={() => votarResolucion("favor")}
                  disabled={!token || estado !== "abierta" || yaVoto || cargando || !enLinea}
                  className="h-24 w-full rounded-xl bg-emerald-600 text-left text-white hover:bg-emerald-700"
                >
                  <div className="flex w-full items-center gap-4">
                    <div className="flex size-14 items-center justify-center rounded-lg bg-white">
                      <Check className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-black">{t("A FAVOR", "IN FAVOR")}</p>
                      <p className="text-sm font-medium text-white/80">
                        {t("Apruebo esta resolución", "I approve this resolution")}
                      </p>
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={() => votarResolucion("contra")}
                  disabled={!token || estado !== "abierta" || yaVoto || cargando || !enLinea}
                  className="h-24 w-full rounded-xl bg-red-600 text-left text-white hover:bg-red-700"
                >
                  <div className="flex w-full items-center gap-4">
                    <div className="flex size-14 items-center justify-center rounded-lg bg-white">
                      <X className="h-8 w-8 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-black">{t("EN CONTRA", "AGAINST")}</p>
                      <p className="text-sm font-medium text-white/80">
                        {t("No apruebo esta resolución", "I do not approve this resolution")}
                      </p>
                    </div>
                  </div>
                </Button>
              </div>
            )}

            {tipoVotacion === "eleccion_lideres" && estado === "abierta" && estadoAsambleaVisible !== "receso" && (
              <div className="mt-5 space-y-3">
                {rondaNumero === 1 && !yaVoto && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-black text-slate-700">
                      {t("Primera ronda: escribe el nombre de tu candidato", "First round: enter your candidate's name")}
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t("Nombre del candidato", "Candidate name")}
                        value={nominacion}
                        onChange={(e) => setNominacion(e.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
                      />
                      <Button
                        onClick={nominarCandidato}
                        disabled={!token || cargando || !enLinea}
                        className="h-11 rounded-lg bg-[#16382f] font-bold hover:bg-[#0f2b24]"
                      >
                        {t("Registrar", "Submit")}
                      </Button>
                    </div>
                  </div>
                )}

                {rondaNumero === 1 && !yaVoto && (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                    {t(
                      "Los nombres registrados en esta primera ronda no se muestran a los demas asambleistas.",
                      "Names submitted in this first round are not shown to other assembly members."
                    )}
                  </p>
                )}

                {(rondaNumero > 1 || conteoCandidatos.length > 0) && (
                  <div className={conteoCandidatos.length > 2 ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>
                    {conteoCandidatos.map((c, index) => (
                      <Button
                        key={c.id}
                        onClick={() => votarCandidato(c.id)}
                        disabled={!token || estado !== "abierta" || yaVoto || cargando || !enLinea}
                        className={["min-h-16 w-full justify-center whitespace-normal rounded-xl border-2 px-3 py-3 text-center text-base font-black leading-tight text-slate-800", claseRanking(index)].join(" ")}
                      >
                        {c.nombre}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#e9f3ef] p-4 text-[#16382f]">
              <ShieldCheck className="h-8 w-8 shrink-0" />
              <div>
                <p className="font-black">{t("Tu voto es anónimo y seguro", "Your vote is anonymous and secure")}</p>
                <p className="text-sm text-[#315f54]">{t("Confidencialidad garantizada", "Confidentiality guaranteed")}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
