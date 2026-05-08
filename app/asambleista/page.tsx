"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useAsamblea } from "@/hooks/useAsamblea"
import { useVotacion } from "@/hooks/useVotacion"
import { hacerCheckin } from "@/lib/checkinApi"
import { enviarVoto } from "@/lib/voteApi"
import { getDeviceId } from "@/lib/deviceId"
import {
  Check,
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
  ASAMBLEISTA_INVALIDO: "No se pudo validar tu registro de asambleísta",
  NO_HABILITADO: "No estás habilitado para votar. Pasa por la mesa de registro.",
  NO_PRESENTE: "No puedes votar porque ya no figuras presente en la asamblea.",
  OPCION_INVALIDA: "La opción seleccionada no es válida para esta votación",
  CANDIDATO_REQUERIDO: "Selecciona un candidato para votar",
  CANDIDATO_INVALIDO: "El candidato seleccionado no pertenece a esta votación",
  CANDIDATO_NO_APLICA: "Esta votación no acepta candidatos",
  OPCION_NO_APLICA: "Esta votación requiere seleccionar un candidato",
}

const MENSAJES_NOMINACION: Record<string, string> = {
  TOKEN_INVALIDO: "Tu sesión no es válida, vuelve a hacer check-in",
  NO_HABILITADO: "No estás habilitado para nominar. Pasa por la mesa de registro.",
  NO_PRESENTE: "No puedes nominar porque no figuras presente en la asamblea.",
  VOTACION_INVALIDA: "No hay una elección de líderes abierta para nominar",
  NOMINACION_CERRADA: "Las nominaciones para esta ronda ya fueron cerradas",
}

export default function AsambleistaPage() {
  const { asambleaId, anioAsamblea, lugarAsamblea, organizacionAsamblea } = useAsamblea()

  const {
    estado,
    votacionId,
    titulo,
    tipoMayoria,
    tipoVotacion,
    tipoMocion,
    rondaNumero,
    conteoCandidatos,
    votosEmitidos,
    yaVoto,
    setYaVoto,
    cargarVotacionActiva,
  } = useVotacion(asambleaId)

  // token ahora almacena el token_hash (retornado por /api/checkin)
  const [token, setToken] = useState("")
  const [credencial, setCredencial] = useState("")
  const [nominacion, setNominacion] = useState("")
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      setToken(localStorage.getItem("token_votacion") || "")
    })
  }, [])

  // Bug #3 corregido: usa /api/checkin que retorna token_hash
  const handleCheckIn = async () => {
    if (!credencial) {
      alert("Ingresa una credencial válida")
      return
    }

    setCargando(true)
    const resultado = await hacerCheckin(credencial.trim().toUpperCase())
    setCargando(false)

    if (!resultado.ok) {
      const mensajes: Record<string, string> = {
        FALTA_CREDENCIAL: "Ingresa una credencial válida",
        NO_HAY_ASAMBLEA: "No hay una asamblea activa en este momento",
        NO_EXISTE: "Credencial no encontrada",
        NO_HABILITADO:
          "No estás habilitado para hacer check-in. Pasa primero por la mesa de registro.",
        ERROR_TOKEN: "Error al generar el token, intenta de nuevo",
        ERROR_SERVIDOR: "Error del servidor, intenta de nuevo",
      }
      alert(mensajes[resultado.error] || "Credencial inválida")
      return
    }

    // Guardamos el token_hash, que es lo que espera la RPC registrar_voto
    localStorage.setItem("token_votacion", resultado.token)
    setToken(resultado.token)
    alert("Acceso concedido")
    await cargarVotacionActiva()
  }

  // Bug #3 corregido: usa /api/vote que llama a la RPC con token_hash
  const votarResolucion = async (opcion: "favor" | "contra") => {
    if (!token || !votacionId) {
      alert("Debes hacer check-in antes de votar")
      return
    }

    setCargando(true)
    const resultado = await enviarVoto({
      token,
      votacionId,
      opcion,
      deviceId: getDeviceId(),
    })
    setCargando(false)

    if (!resultado.ok) {
      alert(MENSAJES_VOTO[resultado.code] || `No se pudo registrar el voto: ${resultado.code}`)
      if (resultado.code === "YA_VOTO") setYaVoto(true)
      return
    }

    setYaVoto(true)
    await cargarVotacionActiva()
    alert("Voto registrado")
  }

  const nominarCandidato = async () => {
    if (!token || !votacionId) {
      alert("Debes hacer check-in antes de nominar")
      return
    }

    if (!nominacion.trim()) {
      alert("Escribe el nombre de la persona nominada")
      return
    }

    setCargando(true)

    const res = await fetch("/api/nominaciones", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        votacionId,
        nombre: nominacion,
      }),
    })

    const data = await res.json()
    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(MENSAJES_NOMINACION[data.error] || "No se pudo registrar la nominación")
      return
    }

    setNominacion("")
    await cargarVotacionActiva()
    alert(data.duplicado ? "Ese nombre ya estaba nominado" : "Nominación registrada")
  }

  const votarCandidato = async (candidatoId: string) => {
    if (!token || !votacionId) {
      alert("Debes hacer check-in antes de votar")
      return
    }

    setCargando(true)
    const resultado = await enviarVoto({
      token,
      votacionId,
      candidatoId,
      deviceId: getDeviceId(),
    })
    setCargando(false)

    if (!resultado.ok) {
      alert(MENSAJES_VOTO[resultado.code] || `No se pudo registrar el voto: ${resultado.code}`)
      if (resultado.code === "YA_VOTO") setYaVoto(true)
      return
    }

    setYaVoto(true)
    await cargarVotacionActiva()
    alert("Voto registrado")
  }

  return (
    <main className="flex min-h-screen justify-center bg-[#f4f6f1] px-4 py-5 pb-28">
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
                {asambleaId
                  ? organizacionAsamblea || `Asamblea ${anioAsamblea}`
                  : "Sin asamblea activa"}
              </h1>
              <p className="truncate text-sm text-white/68">
                {asambleaId ? `Asamblea ${anioAsamblea} · ${lugarAsamblea}` : "No iniciada"}
              </p>
              </div>
            </div>

            <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
              {token ? "Acreditado" : "Acceso"}
            </div>
          </div>

          <div className="mt-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#d7c27a]">
              Participación
            </p>
            <p className="mt-2 text-3xl font-black leading-tight">
              Vota de forma clara, rápida y segura
            </p>
          </div>
        </section>

        <section className="-mt-10 space-y-4 px-4 pb-5">
          {!token && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">
                Check-in de asambleísta
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Ingresa tu credencial para habilitar esta sesión de votación.
              </p>

              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Ej: A001"
                  value={credencial}
                  onChange={(e) => setCredencial(e.target.value)}
                  className="h-12 w-full rounded-lg border border-slate-200 px-4 text-lg font-bold uppercase outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
                />
                <Button
                  onClick={handleCheckIn}
                  disabled={cargando}
                  className="h-12 rounded-lg bg-[#16382f] px-5 font-bold hover:bg-[#0f2b24]"
                >
                  {cargando ? "..." : "Entrar"}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`mb-5 flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-black tracking-wide ${
              estado === "abierta"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}>
              <span className={`size-2.5 rounded-full ${estado === "abierta" ? "bg-emerald-500" : "bg-amber-500"}`} />
              {estado === "abierta" ? "VOTACIÓN ACTIVA" : "EN ESPERA"}
            </div>

            <h2 className="text-2xl font-black leading-tight text-slate-950">
              {titulo || "Sin votación activa"}
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
                Mayoría requerida: {mostrarTipoMayoria(tipoMayoria)}
              </p>
            </div>

            {!token && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm font-bold text-red-700">
                Debes hacer check-in antes de votar.
              </p>
            )}

            {yaVoto && (
              <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700">
                Tu voto ya fue registrado.
              </p>
            )}

            {estado === "cerrada" && titulo && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-center text-sm font-bold text-amber-700">
                La votación ha sido cerrada.
              </p>
            )}

            {tipoVotacion === "resolucion" && estado === "abierta" && (
              <div className="mt-5 space-y-3">
                <Button
                  onClick={() => votarResolucion("favor")}
                  disabled={!token || estado !== "abierta" || yaVoto || cargando}
                  className="h-24 w-full rounded-xl bg-emerald-600 text-left text-white hover:bg-emerald-700"
                >
                  <div className="flex w-full items-center gap-4">
                    <div className="flex size-14 items-center justify-center rounded-lg bg-white">
                      <Check className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-black">A FAVOR</p>
                      <p className="text-sm font-medium text-white/80">Apruebo esta resolución</p>
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={() => votarResolucion("contra")}
                  disabled={!token || estado !== "abierta" || yaVoto || cargando}
                  className="h-24 w-full rounded-xl bg-red-600 text-left text-white hover:bg-red-700"
                >
                  <div className="flex w-full items-center gap-4">
                    <div className="flex size-14 items-center justify-center rounded-lg bg-white">
                      <X className="h-8 w-8 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-black">EN CONTRA</p>
                      <p className="text-sm font-medium text-white/80">No apruebo esta resolución</p>
                    </div>
                  </div>
                </Button>
              </div>
            )}

            {tipoVotacion === "eleccion_lideres" && estado === "abierta" && (
              <div className="mt-5 space-y-3">
                {rondaNumero === 1 && votosEmitidos === 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-black text-slate-700">
                      Nominar candidato
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nombre del nominado"
                        value={nominacion}
                        onChange={(e) => setNominacion(e.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
                      />
                      <Button
                        onClick={nominarCandidato}
                        disabled={!token || cargando}
                        className="h-11 rounded-lg bg-[#16382f] font-bold hover:bg-[#0f2b24]"
                      >
                        Nominar
                      </Button>
                    </div>
                  </div>
                )}

                {conteoCandidatos.map((c, index) => (
                  <Button
                    key={c.id}
                    onClick={() => votarCandidato(c.id)}
                    disabled={!token || estado !== "abierta" || yaVoto || cargando}
                    className={`h-16 w-full justify-start rounded-xl border-2 px-4 text-left text-base font-black text-slate-800 ${claseRanking(index)}`}
                  >
                    {c.nombre}
                  </Button>
                ))}
              </div>
            )}

            <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#e9f3ef] p-4 text-[#16382f]">
              <ShieldCheck className="h-8 w-8 shrink-0" />
              <div>
                <p className="font-black">Tu voto es anónimo y seguro</p>
                <p className="text-sm text-[#315f54]">Confidencialidad garantizada</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
