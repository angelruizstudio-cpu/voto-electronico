import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { Candidato, ConteoCandidato, ResultadoCerrado } from "@/lib/types"

export function crearRecargaSerial() {
  let enCurso: Promise<void> | null = null
  let pendiente = false
  let ultimaTarea: () => Promise<void> = async () => {}

  return (tarea: () => Promise<void>) => {
    ultimaTarea = tarea

    if (enCurso) {
      pendiente = true
      return enCurso
    }

    enCurso = (async () => {
      do {
        pendiente = false
        await ultimaTarea()
      } while (pendiente)
    })().finally(() => {
      enCurso = null
    })

    return enCurso
  }
}

export function useVotacion(
  asambleaId: string | null,
  opciones: {
    ocultarCandidatosPrimeraRonda?: boolean
    modoAsambleista?: boolean
    incluirResultadosPublicados?: boolean
  } = {}
) {
  const [estado, setEstado] = useState("cerrada")
  const [votacionId, setVotacionId] = useState<string | null>(null)
  const [titulo, setTitulo] = useState("")
  const [tipoMayoria, setTipoMayoria] = useState("")
  const [tipoVotacion, setTipoVotacion] = useState("resolucion")
  const [tipoMocion, setTipoMocion] = useState("resolucion_principal")
  const [mocionPadreId, setMocionPadreId] = useState<string | null>(null)
  const [resolucionRaizId, setResolucionRaizId] = useState<string | null>(null)
  const [publicada, setPublicada] = useState(false)
  const [rondaNumero, setRondaNumero] = useState(1)
  const [eleccionGrupoId, setEleccionGrupoId] = useState<string | null>(null)

  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [conteoCandidatos, setConteoCandidatos] = useState<ConteoCandidato[]>([])

  const [votosEmitidos, setVotosEmitidos] = useState(0)
  const [votosAFavor, setVotosAFavor] = useState(0)
  const [votosEnContra, setVotosEnContra] = useState(0)
  const [votosAbstencion, setVotosAbstencion] = useState(0)
  const [yaVoto, setYaVoto] = useState(false)

  const [resultadosCerrados, setResultadosCerrados] = useState<ResultadoCerrado[]>([])

  const cargarUnaVezRef = useRef<() => Promise<void>>(async () => {})
  const [recargarSerial] = useState(() => crearRecargaSerial())

  const limpiarVotacion = useCallback(() => {
    setEstado("cerrada")
    setVotacionId(null)
    setTitulo("")
    setTipoMayoria("")
    setTipoVotacion("resolucion")
    setTipoMocion("resolucion_principal")
    setMocionPadreId(null)
    setResolucionRaizId(null)
    setPublicada(false)
    setRondaNumero(1)
    setEleccionGrupoId(null)
    setCandidatos([])
    setConteoCandidatos([])
    setVotosEmitidos(0)
    setVotosAFavor(0)
    setVotosEnContra(0)
    setVotosAbstencion(0)
    setYaVoto(false)
  }, [])

  const cargarVotacionActivaUnaVez = useCallback(async () => {
    if (!asambleaId) {
      limpiarVotacion()
      return
    }

    const tokenLocal =
      opciones.modoAsambleista && typeof window !== "undefined"
        ? localStorage.getItem("token_votacion")
        : null

    if (opciones.modoAsambleista && !tokenLocal) {
      limpiarVotacion()
      return
    }

    const params = new URLSearchParams({ asambleaId })

    if (opciones.modoAsambleista) params.set("modo", "asambleista")
    if (opciones.modoAsambleista && votacionId) params.set("actual", votacionId)
    if (opciones.incluirResultadosPublicados) params.set("resultados", "1")

    const res = await fetch(`/api/votacion-activa?${params.toString()}`, {
      cache: "no-store",
      headers: tokenLocal ? { "x-voting-token": tokenLocal } : undefined,
    }).catch(() => null)

    if (!res?.ok) {
      console.error("[Votacion] No se pudo actualizar la votacion activa", res?.status || "red")
      return
    }

    const respuesta = await res.json().catch(() => null)

    if (respuesta?.sinCambios) return

    const data = respuesta?.votacion

    if (!data) {
      limpiarVotacion()
      return
    }

    setEstado(data.estado)
    setVotacionId(data.id)
    setTitulo(data.titulo)
    setTipoMayoria(data.tipo_mayoria || "")
    setTipoVotacion(data.tipo_votacion || "resolucion")
    setTipoMocion(data.tipo_mocion || "resolucion_principal")
    setMocionPadreId(data.mocion_padre_id || null)
    setResolucionRaizId(data.resolucion_raiz_id || data.id)
    setPublicada(data.publicada || false)
    setRondaNumero(data.ronda_numero || 1)
    setEleccionGrupoId(data.eleccion_grupo_id || data.id)
    setCandidatos(respuesta.candidatos || [])
    setConteoCandidatos(respuesta.conteoCandidatos || [])
    setVotosEmitidos(respuesta.votosEmitidos || 0)
    setVotosAFavor(respuesta.votosAFavor || 0)
    setVotosEnContra(respuesta.votosEnContra || 0)
    setVotosAbstencion(respuesta.votosAbstencion || 0)
    setYaVoto(Boolean(respuesta.yaVoto))
  }, [
    asambleaId,
    limpiarVotacion,
    opciones.incluirResultadosPublicados,
    opciones.modoAsambleista,
    votacionId,
  ])

  const cargarVotacionActiva = useCallback(async () => {
    await recargarSerial(cargarUnaVezRef.current)
  }, [recargarSerial])

  useEffect(() => {
    cargarUnaVezRef.current = cargarVotacionActivaUnaVez
  }, [cargarVotacionActivaUnaVez])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarVotacionActiva()
    })
  }, [
    asambleaId,
    cargarVotacionActiva,
    opciones.incluirResultadosPublicados,
    opciones.modoAsambleista,
  ])

  useEffect(() => {
    if (!asambleaId) return

    let refrescoProgramado: number | null = null
    const programarRefresco = () => {
      if (refrescoProgramado !== null) return

      const espera = opciones.modoAsambleista ? Math.floor(Math.random() * 4000) : 0
      refrescoProgramado = window.setTimeout(() => {
        refrescoProgramado = null
        void cargarVotacionActiva()
      }, espera)
    }

    const canalVotaciones = supabase
      .channel(`realtime-votaciones-${asambleaId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votaciones",
          filter: `asamblea_id=eq.${asambleaId}`,
        },
        programarRefresco
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          programarRefresco()
        }
      })

    return () => {
      if (refrescoProgramado !== null) window.clearTimeout(refrescoProgramado)
      supabase.removeChannel(canalVotaciones)
    }
  }, [asambleaId, cargarVotacionActiva, opciones.modoAsambleista])

  useEffect(() => {
    if (!votacionId) return

    if (opciones.modoAsambleista) return

    const canalCandidatos = supabase
      .channel(`realtime-candidatos-${votacionId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "candidatos",
          filter: `votacion_id=eq.${votacionId}`,
        },
        () => void cargarVotacionActiva()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalCandidatos)
    }
  }, [cargarVotacionActiva, opciones.modoAsambleista, votacionId])

  useEffect(() => {
    if (!asambleaId) return

    let cancelado = false
    let refresco: number | null = null

    const programarRefresco = () => {
      const espera = opciones.modoAsambleista
        ? 8000 + Math.floor(Math.random() * 4000)
        : 3000

      refresco = window.setTimeout(async () => {
        if (document.visibilityState === "visible") await cargarVotacionActiva()
        if (!cancelado) programarRefresco()
      }, espera)
    }

    programarRefresco()

    return () => {
      cancelado = true
      if (refresco !== null) window.clearTimeout(refresco)
    }
  }, [asambleaId, cargarVotacionActiva, opciones.modoAsambleista])

  useEffect(() => {
    if (!asambleaId) return

    const refrescarAlVolver = () => {
      if (document.visibilityState === "visible") void cargarVotacionActiva()
    }

    window.addEventListener("focus", refrescarAlVolver)
    document.addEventListener("visibilitychange", refrescarAlVolver)

    return () => {
      window.removeEventListener("focus", refrescarAlVolver)
      document.removeEventListener("visibilitychange", refrescarAlVolver)
    }
  }, [asambleaId, cargarVotacionActiva])

  return {
    estado,
    setEstado,
    votacionId,
    setVotacionId,
    titulo,
    setTitulo,
    tipoMayoria,
    setTipoMayoria,
    tipoVotacion,
    setTipoVotacion,
    tipoMocion,
    setTipoMocion,
    mocionPadreId,
    setMocionPadreId,
    resolucionRaizId,
    setResolucionRaizId,
    publicada,
    setPublicada,
    rondaNumero,
    setRondaNumero,
    eleccionGrupoId,
    setEleccionGrupoId,
    candidatos,
    setCandidatos,
    conteoCandidatos,
    setConteoCandidatos,
    votosEmitidos,
    setVotosEmitidos,
    votosAFavor,
    setVotosAFavor,
    votosEnContra,
    setVotosEnContra,
    votosAbstencion,
    setVotosAbstencion,
    yaVoto,
    setYaVoto,
    resultadosCerrados,
    setResultadosCerrados,
    cargarVotacionActiva,
  }
}
