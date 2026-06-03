"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"

type VotacionCerrada = {
  id: string
  titulo: string
  tipo_votacion: "resolucion" | "eleccion_lideres"
  estado: string
  ronda_numero?: number | null
}

type CandidatoManual = {
  id: string
  nombre: string
}

type VotoManual = {
  opcion: string | null
  candidato_id: string | null
  cantidad: number
}

type NombreManual = {
  id: string
  nombre: string
  cantidad: number
}

export type ResultadoManualActualizado =
  | {
      tipo: "resolucion"
      titulo: string
      emitidos: number
      electronicos: number
      manuales: number
      favor: number
      contra: number
      abstencion: number
      favorElectronico: number
      contraElectronico: number
      abstencionElectronica: number
      favorManual: number
      contraManual: number
      abstencionManual: number
      validos: number
      necesarios: number
      resultado: "aprobada" | "rechazada"
    }
  | {
      tipo: "eleccion_lideres"
      votacionId: string
      titulo: string
      emitidos: number
      electronicos: number
      manuales: number
      necesarios: number
      nulas: number
      danadas: number
      rondaNumero: number
      eleccionGrupoId: string | null
      resultado: string
      ganadorId: string | null
      ganadorNombre: string | null
      candidatos: {
        id: string
        nombre: string
        electronicos: number
        manuales: number
        votos: number
        porcentaje: number
      }[]
    }

type VotosManualesPanelProps = {
  asambleaId: string | null
  onResultadosActualizados?: (resultado: ResultadoManualActualizado | null) => void
}

const numeroSeguro = (valor: string) => {
  const numero = Number(valor)
  return Number.isFinite(numero) && numero >= 0 ? Math.floor(numero) : 0
}

export function ResultadoOficialActualizado({
  resultado,
  onCrearSiguienteRonda,
  creandoSiguienteRonda = false,
}: {
  resultado: ResultadoManualActualizado | null
  onCrearSiguienteRonda?: (
    resultado: Extract<ResultadoManualActualizado, { tipo: "eleccion_lideres" }>
  ) => void
  creandoSiguienteRonda?: boolean
}) {
  if (!resultado) return null

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
        Resultado oficial actualizado
      </p>
      <h3 className="mt-1 text-lg font-black text-slate-950">{resultado.titulo}</h3>
      <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-3">
        <p className="rounded bg-white p-3">Emitidos: {resultado.emitidos}</p>
        <p className="rounded bg-white p-3">Electrónicos: {resultado.electronicos}</p>
        <p className="rounded bg-white p-3">Manuales: {resultado.manuales}</p>
      </div>

      {resultado.tipo === "resolucion" ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded bg-white p-3">
              <p className="text-xs font-bold uppercase text-emerald-700">A favor</p>
              <p className="text-2xl font-black text-emerald-800">{resultado.favor}</p>
              <p className="text-xs text-slate-500">
                {resultado.favorElectronico} elec. + {resultado.favorManual} manual
              </p>
            </div>
            <div className="rounded bg-white p-3">
              <p className="text-xs font-bold uppercase text-red-700">En contra</p>
              <p className="text-2xl font-black text-red-800">{resultado.contra}</p>
              <p className="text-xs text-slate-500">
                {resultado.contraElectronico} elec. + {resultado.contraManual} manual
              </p>
            </div>
            <div className="rounded bg-white p-3">
              <p className="text-xs font-bold uppercase text-slate-700">Abstención</p>
              <p className="text-2xl font-black text-slate-800">{resultado.abstencion}</p>
              <p className="text-xs text-slate-500">
                {resultado.abstencionElectronica} elec. + {resultado.abstencionManual} manual
              </p>
            </div>
            <div className="rounded bg-white p-3">
              <p className="text-xs font-bold uppercase text-slate-700">Necesarios</p>
              <p className="text-2xl font-black text-slate-950">{resultado.necesarios}</p>
              <p className="text-xs text-slate-500">Válidos: {resultado.validos}</p>
            </div>
          </div>
          <p
            className={`rounded p-3 text-base font-black ${
              resultado.resultado === "aprobada"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            Para notificar al presidente:{" "}
            {resultado.resultado === "aprobada"
              ? "la moción queda aprobada"
              : "la moción queda rechazada"}
            .
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {resultado.candidatos.map((candidato, index) => (
            <div
              key={candidato.id}
              className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded bg-white p-3 text-sm"
            >
              <p className="font-black">#{index + 1}</p>
              <div>
                <p className="font-black text-slate-950">{candidato.nombre}</p>
                <p className="text-xs text-slate-500">
                  {candidato.electronicos} elec. + {candidato.manuales} manual
                </p>
              </div>
              <p className="font-black text-[#16382f]">
                {candidato.votos} votos · {candidato.porcentaje}%
              </p>
            </div>
          ))}
          {(resultado.nulas > 0 || resultado.danadas > 0) && (
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="rounded bg-white p-3 text-sm font-bold text-amber-800">
                Balotas nulas: {resultado.nulas}
              </p>
              <p className="rounded bg-white p-3 text-sm font-bold text-amber-800">
                Balotas daÃ±adas: {resultado.danadas}
              </p>
            </div>
          )}
          <p className="rounded bg-white p-3 text-base font-black text-slate-950">
            Para notificar al presidente:{" "}
            {resultado.ganadorNombre
              ? `${resultado.ganadorNombre} queda electo.`
              : resultado.resultado === "requiere_nueva_ronda"
              ? "no hubo elección; se requiere una nueva ronda."
              : resultado.resultado === "empate_sorteo"
              ? "hay empate final; corresponde sorteo físico."
              : "no hubo elección."}
          </p>
          {resultado.resultado === "requiere_nueva_ronda" && (
            <Button
              type="button"
              onClick={() => onCrearSiguienteRonda?.(resultado)}
              disabled={!onCrearSiguienteRonda || creandoSiguienteRonda}
              className="w-full"
            >
              {creandoSiguienteRonda ? "Creando ronda..." : "Crear siguiente ronda"}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function VotosManualesPanel({
  asambleaId,
  onResultadosActualizados,
}: VotosManualesPanelProps) {
  const [votaciones, setVotaciones] = useState<VotacionCerrada[]>([])
  const [votacionId, setVotacionId] = useState("")
  const [candidatos, setCandidatos] = useState<CandidatoManual[]>([])
  const [favor, setFavor] = useState(0)
  const [contra, setContra] = useState(0)
  const [abstencion, setAbstencion] = useState(0)
  const [votosCandidato, setVotosCandidato] = useState<Record<string, number>>({})
  const [nombresManuales, setNombresManuales] = useState<NombreManual[]>([])
  const [balotasNulas, setBalotasNulas] = useState(0)
  const [balotasDanadas, setBalotasDanadas] = useState(0)
  const [hayGuardados, setHayGuardados] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [votantesManualesPresentes, setVotantesManualesPresentes] = useState(0)

  const votacionSeleccionada = useMemo(
    () => votaciones.find((votacion) => votacion.id === votacionId) || null,
    [votacionId, votaciones]
  )

  const cargarVotaciones = useCallback(async () => {
    if (!asambleaId) {
      setVotaciones([])
      setVotacionId("")
      return
    }

    const { data, error } = await supabase
      .from("votaciones")
      .select("id, titulo, tipo_votacion, estado, ronda_numero")
      .eq("asamblea_id", asambleaId)
      .eq("estado", "cerrada")
      .order("creada_en", { ascending: false })

    if (error) {
      alert(error.message)
      return
    }

    const cerradas = (data || []) as VotacionCerrada[]
    setVotaciones(cerradas)
    setVotacionId((actual) => actual || cerradas[0]?.id || "")
  }, [asambleaId])

  const cargarDetalle = useCallback(async () => {
    if (!votacionId) {
      setCandidatos([])
      setFavor(0)
      setContra(0)
      setAbstencion(0)
      setVotosCandidato({})
      setNombresManuales([])
      setBalotasNulas(0)
      setBalotasDanadas(0)
      setHayGuardados(false)
      setVotantesManualesPresentes(0)
      onResultadosActualizados?.(null)
      return
    }

    setCargando(true)

    const res = await fetch(`/api/votos-manuales?votacionId=${encodeURIComponent(votacionId)}`)
    const data = await res.json()

    if (!res.ok || !data.ok) {
      setCargando(false)
      alert(data.error || "No se pudieron cargar los votos manuales")
      return
    }

    const votosManuales = (data.votosManuales || []) as VotoManual[]
    const tieneVotosManualesGuardados = votosManuales.length > 0
    setVotantesManualesPresentes(Number(data.votantesManualesPresentes) || 0)
    onResultadosActualizados?.(
      tieneVotosManualesGuardados ? data.resultadosActualizados || null : null
    )
    setHayGuardados(tieneVotosManualesGuardados)
    setFavor(votosManuales.find((voto) => voto.opcion === "favor")?.cantidad || 0)
    setContra(votosManuales.find((voto) => voto.opcion === "contra")?.cantidad || 0)
    setAbstencion(votosManuales.find((voto) => voto.opcion === "abstencion")?.cantidad || 0)
    setBalotasNulas(votosManuales.find((voto) => voto.opcion === "nula")?.cantidad || 0)
    setBalotasDanadas(votosManuales.find((voto) => voto.opcion === "danada")?.cantidad || 0)
    setNombresManuales([])

    const { data: candidatosData, error: errorCandidatos } = await supabase
      .from("candidatos")
      .select("id, nombre")
      .eq("votacion_id", votacionId)
      .order("nombre", { ascending: true })

    setCargando(false)

    if (errorCandidatos) {
      alert(errorCandidatos.message)
      return
    }

    const candidatosLista = (candidatosData || []) as CandidatoManual[]
    setCandidatos(candidatosLista)
    setVotosCandidato(
      candidatosLista.reduce<Record<string, number>>((acc, candidato) => {
        acc[candidato.id] = votosManuales
          .filter((voto) => voto.candidato_id === candidato.id)
          .reduce((total, voto) => total + voto.cantidad, 0)
        return acc
      }, {})
    )
  }, [onResultadosActualizados, votacionId])

  const totalManual = useMemo(() => {
    if (votacionSeleccionada?.tipo_votacion === "eleccion_lideres") {
      return (
        Object.values(votosCandidato).reduce((total, cantidad) => total + cantidad, 0) +
        nombresManuales.reduce((total, fila) => total + fila.cantidad, 0) +
        balotasNulas +
        balotasDanadas
      )
    }

    return favor + contra + abstencion
  }, [
    abstencion,
    balotasDanadas,
    balotasNulas,
    contra,
    favor,
    nombresManuales,
    votacionSeleccionada?.tipo_votacion,
    votosCandidato,
  ])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarVotaciones()
    })
  }, [cargarVotaciones])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarDetalle()
    })
  }, [cargarDetalle])

  const agregarNombreManual = () => {
    setNombresManuales((actual) => [
      ...actual,
      { id: crypto.randomUUID(), nombre: "", cantidad: 1 },
    ])
  }

  const guardar = async () => {
    if (!votacionSeleccionada) return

    if (votacionSeleccionada.estado !== "cerrada") {
      alert("Primero debes cerrar la votación")
      return
    }

    if (totalManual > votantesManualesPresentes) {
      alert(
        `Los votos manuales (${totalManual}) no pueden exceder los asambleístas manuales presentes (${votantesManualesPresentes}).`
      )
      return
    }

    if (
      hayGuardados &&
      !window.confirm("Ya existen votos manuales guardados para esta votación. ¿Deseas reemplazarlos?")
    ) {
      return
    }

    const votos =
      votacionSeleccionada.tipo_votacion === "eleccion_lideres"
        ? [
            ...candidatos.map((candidato) => ({
              candidatoId: candidato.id,
              cantidad: votosCandidato[candidato.id] || 0,
            })),
            ...nombresManuales
              .map((fila) => ({
                candidatoNombre: fila.nombre.trim(),
                cantidad: fila.cantidad,
              }))
              .filter((fila) => fila.candidatoNombre && fila.cantidad > 0),
            { opcion: "nula", cantidad: balotasNulas },
            { opcion: "danada", cantidad: balotasDanadas },
          ]
        : [
            { opcion: "favor", cantidad: favor },
            { opcion: "contra", cantidad: contra },
            { opcion: "abstencion", cantidad: abstencion },
          ]

    setCargando(true)

    const res = await fetch("/api/votos-manuales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ votacionId, votos }),
    })
    const data = await res.json()

    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudieron guardar los votos manuales")
      return
    }

    onResultadosActualizados?.(data.resultadosActualizados || null)
    setHayGuardados(true)
    await cargarDetalle()
    alert("Votos manuales guardados. Resultados oficiales actualizados.")
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f5b1d]">
            Comité de escrutinio
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Registrar votos manuales</h2>
          <p className="mt-1 text-sm text-slate-500">
            Solo para votaciones cerradas. Estos totales se suman al resultado oficial.
          </p>
        </div>
        <Button type="button" onClick={cargarVotaciones} disabled={cargando}>
          Recargar votaciones
        </Button>
      </div>

      {votaciones.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">
          No hay votaciones cerradas disponibles.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <select
            value={votacionId}
            onChange={(e) => setVotacionId(e.target.value)}
            className="h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
          >
            {votaciones.map((votacion) => (
              <option key={votacion.id} value={votacion.id}>
                {votacion.titulo}
              </option>
            ))}
          </select>

          {votacionSeleccionada?.tipo_votacion === "eleccion_lideres" ? (
            <div className="space-y-2">
              {candidatos.map((candidato) => (
                <label
                  key={candidato.id}
                  className="grid grid-cols-[1fr_96px] items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm font-bold"
                >
                  <span>{candidato.nombre}</span>
                  <input
                    type="number"
                    min={0}
                    max={votantesManualesPresentes}
                    value={votosCandidato[candidato.id] || 0}
                    onChange={(e) =>
                      setVotosCandidato((actual) => ({
                        ...actual,
                        [candidato.id]: numeroSeguro(e.target.value),
                      }))
                    }
                    className="h-10 rounded-lg border border-slate-200 px-3 text-right outline-none"
                  />
                </label>
              ))}
              {(votacionSeleccionada.ronda_numero || 1) === 1 && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-amber-900">
                        Balotas manuales con nombre
                      </p>
                      <p className="text-xs font-semibold text-amber-800">
                        Solo para la primera ronda. Escribe nombres que llegaron en balotas manuales.
                      </p>
                    </div>
                    <Button type="button" onClick={agregarNombreManual} className="shrink-0">
                      AÃ±adir nombre
                    </Button>
                  </div>

                  {nombresManuales.length === 0 ? (
                    <p className="rounded bg-white/70 p-3 text-sm font-semibold text-amber-800">
                      No hay nombres escritos adicionales.
                    </p>
                  ) : (
                    nombresManuales.map((fila) => (
                      <div
                        key={fila.id}
                        className="grid gap-2 rounded bg-white p-3 sm:grid-cols-[1fr_96px_auto]"
                      >
                        <input
                          type="text"
                          placeholder="Nombre escrito en la balota"
                          value={fila.nombre}
                          onChange={(e) =>
                            setNombresManuales((actual) =>
                              actual.map((item) =>
                                item.id === fila.id ? { ...item, nombre: e.target.value } : item
                              )
                            )
                          }
                          className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none"
                        />
                        <input
                          type="number"
                          min={0}
                          max={votantesManualesPresentes}
                          value={fila.cantidad}
                          onChange={(e) =>
                            setNombresManuales((actual) =>
                              actual.map((item) =>
                                item.id === fila.id
                                  ? { ...item, cantidad: numeroSeguro(e.target.value) }
                                  : item
                              )
                            )
                          }
                          className="h-10 rounded-lg border border-slate-200 px-3 text-right outline-none"
                        />
                        <Button
                          type="button"
                          onClick={() =>
                            setNombresManuales((actual) =>
                              actual.filter((item) => item.id !== fila.id)
                            )
                          }
                          className="bg-slate-600 hover:bg-slate-700"
                        >
                          Quitar
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-bold text-amber-800">
                  <span>Balotas nulas</span>
                  <input
                    type="number"
                    min={0}
                    max={votantesManualesPresentes}
                    value={balotasNulas}
                    onChange={(e) => setBalotasNulas(numeroSeguro(e.target.value))}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950 outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm font-bold text-amber-800">
                  <span>Balotas daÃ±adas</span>
                  <input
                    type="number"
                    min={0}
                    max={votantesManualesPresentes}
                    value={balotasDanadas}
                    onChange={(e) => setBalotasDanadas(numeroSeguro(e.target.value))}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950 outline-none"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm font-bold text-emerald-700">
                <span>A favor</span>
                <input
                  type="number"
                  min={0}
                  max={votantesManualesPresentes}
                  value={favor}
                  onChange={(e) => setFavor(numeroSeguro(e.target.value))}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950 outline-none"
                />
              </label>
              <label className="space-y-1 text-sm font-bold text-red-700">
                <span>En contra</span>
                <input
                  type="number"
                  min={0}
                  max={votantesManualesPresentes}
                  value={contra}
                  onChange={(e) => setContra(numeroSeguro(e.target.value))}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950 outline-none"
                />
              </label>
              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Abstención</span>
                <input
                  type="number"
                  min={0}
                  max={votantesManualesPresentes}
                  value={abstencion}
                  onChange={(e) => setAbstencion(numeroSeguro(e.target.value))}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950 outline-none"
                />
              </label>
            </div>
          )}

          <p
            className={`rounded-lg p-3 text-sm font-semibold ${
              totalManual > votantesManualesPresentes
                ? "bg-red-50 text-red-700"
                : "bg-slate-50 text-slate-600"
            }`}
          >
            Votos manuales registrados: {totalManual} / {votantesManualesPresentes} asambleístas manuales presentes.
          </p>

          {hayGuardados && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Ya hay votos manuales guardados para esta votación. Al guardar se reemplazarán los totales anteriores.
            </p>
          )}

          <Button
            type="button"
            onClick={guardar}
            disabled={cargando || !votacionId || totalManual > votantesManualesPresentes}
            className="bg-[#16382f] hover:bg-[#0f2b24]"
          >
            Guardar votos manuales
          </Button>
        </div>
      )}
    </div>
  )
}
