"use client"

import { useEffect, useState } from "react"
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
  claseRanking,
} from "@/lib/votacionHelpers"

export default function AsambleistaPage() {
  const { asambleaId, anioAsamblea, lugarAsamblea } = useAsamblea()

  const {
    estado,
    votacionId,
    titulo,
    tipoMayoria,
    tipoVotacion,
    candidatos,
    conteoCandidatos,
    yaVoto,
    setYaVoto,
    cargarVotacionActiva,
  } = useVotacion(asambleaId)

  // token ahora almacena el token_hash (retornado por /api/checkin)
  const [token, setToken] = useState("")
  const [credencial, setCredencial] = useState("")
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem("token_votacion")
    if (t) setToken(t)
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
      const mensajes: Record<string, string> = {
        YA_VOTO: "Ya registraste tu voto en esta votación",
        TOKEN_INVALIDO: "Tu sesión no es válida, vuelve a hacer check-in",
        VOTACION_CERRADA: "La votación ya fue cerrada",
      }
      alert(mensajes[resultado.code] || "No se pudo registrar el voto")
      if (resultado.code === "YA_VOTO") setYaVoto(true)
      return
    }

    setYaVoto(true)
    await cargarVotacionActiva()
    alert("Voto registrado")
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
      const mensajes: Record<string, string> = {
        YA_VOTO: "Ya registraste tu voto en esta votación",
        TOKEN_INVALIDO: "Tu sesión no es válida, vuelve a hacer check-in",
        VOTACION_CERRADA: "La votación ya fue cerrada",
      }
      alert(mensajes[resultado.code] || "No se pudo registrar el voto")
      if (resultado.code === "YA_VOTO") setYaVoto(true)
      return
    }

    setYaVoto(true)
    await cargarVotacionActiva()
    alert("Voto registrado")
  }

  return (
    <main className="min-h-screen bg-slate-100 flex justify-center px-4 py-6">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl">

        <section className="bg-gradient-to-b from-slate-950 to-slate-900 px-6 pt-8 pb-20 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-300">
                Voto electrónico
              </p>
              <h1 className="text-xl font-bold">
                Asamblea {anioAsamblea || ""}
              </h1>
              <p className="text-sm text-slate-300">{lugarAsamblea}</p>
            </div>

            <div className="flex items-center gap-2 text-sm text-white">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span>Conectado</span>
            </div>
          </div>
        </section>

        <section className="-mt-14 px-5 pb-5">
          {!token && (
            <div className="mb-4 rounded-3xl bg-white p-5 shadow-xl">
              <h2 className="mb-3 text-lg font-bold text-slate-900">
                Check-in de asambleísta
              </h2>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej: A001"
                  value={credencial}
                  onChange={(e) => setCredencial(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-lg outline-none"
                />
                <Button
                  onClick={handleCheckIn}
                  disabled={cargando}
                  className="rounded-xl px-5"
                >
                  {cargando ? "..." : "Entrar"}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-[2rem] bg-white p-6 shadow-xl">
            <div className={`mx-auto mb-5 flex w-fit items-center gap-2 rounded-full px-5 py-2 ${
              estado === "abierta"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}>
              <span className={`h-3 w-3 rounded-full ${estado === "abierta" ? "bg-green-500" : "bg-red-500"}`} />
              <span className="font-bold">
                {estado === "abierta" ? "VOTACIÓN ACTIVA" : "VOTACIÓN CERRADA"}
              </span>
            </div>

            <h2 className="text-center text-3xl font-extrabold text-slate-900">
              {titulo || "Sin votación activa"}
            </h2>

            <div className="mx-auto my-5 h-1 w-24 rounded-full bg-indigo-500" />

            <p className="text-center text-lg text-slate-700">
              {mostrarTipoVotacion(tipoVotacion)}
            </p>

            <p className="mt-1 text-center text-sm text-slate-500">
              Mayoría: {mostrarTipoMayoria(tipoMayoria)}
            </p>

            {!token && (
              <p className="mt-5 rounded-xl bg-red-50 p-3 text-center font-semibold text-red-600">
                Debes hacer check-in antes de votar.
              </p>
            )}

            {yaVoto && (
              <p className="mt-5 rounded-xl bg-green-50 p-3 text-center font-semibold text-green-700">
                Tu voto ya fue registrado.
              </p>
            )}

            {estado === "cerrada" && titulo && (
              <p className="mt-5 rounded-xl bg-red-50 p-3 text-center font-semibold text-red-600">
                La votación ha sido cerrada.
              </p>
            )}

            {tipoVotacion === "resolucion" && estado === "abierta" && (
              <div className="mt-8 space-y-4">
                <Button
                  onClick={() => votarResolucion("favor")}
                  disabled={!token || estado !== "abierta" || yaVoto || cargando}
                  className="h-24 w-full rounded-3xl bg-green-600 text-left text-white hover:bg-green-700"
                >
                  <div className="flex w-full items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
                      <Check className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold">A FAVOR</p>
                      <p className="text-sm font-normal">Apruebo esta resolución</p>
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={() => votarResolucion("contra")}
                  disabled={!token || estado !== "abierta" || yaVoto || cargando}
                  className="h-24 w-full rounded-3xl bg-red-600 text-left text-white hover:bg-red-700"
                >
                  <div className="flex w-full items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
                      <X className="h-8 w-8 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold">EN CONTRA</p>
                      <p className="text-sm font-normal">No apruebo esta resolución</p>
                    </div>
                  </div>
                </Button>
              </div>
            )}

            {tipoVotacion === "eleccion_lideres" && estado === "abierta" && (
              <div className="mt-8 space-y-3">
                {conteoCandidatos.map((c, index) => (
                  <Button
                    key={c.id}
                    onClick={() => votarCandidato(c.id)}
                    disabled={!token || estado !== "abierta" || yaVoto || cargando}
                    className={`h-20 w-full justify-start rounded-3xl border-2 text-lg font-bold text-slate-800 ${claseRanking(index)}`}
                  >
                    {c.nombre}
                  </Button>
                ))}
              </div>
            )}

            <div className="mt-8 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-slate-700">
              <ShieldCheck className="h-8 w-8 text-indigo-600" />
              <div>
                <p className="font-bold">Tu voto es anónimo y seguro</p>
                <p className="text-sm">Confidencialidad garantizada</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}