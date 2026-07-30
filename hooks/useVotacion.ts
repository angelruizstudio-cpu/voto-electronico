import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { Candidato, ConteoCandidato, ResultadoCerrado } from "@/lib/types"

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

  const cargarVotacionActivaRef = useRef<() => void>(() => {})

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

  const cargarVotacionActiva = useCallback(async () => {
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
    if (opciones.incluirResultadosPublicados) params.set("resultados", "1")

    const res = await fetch(`/api/votacion-activa?${params.toString()}`, {
      cache: "no-store",
      headers: tokenLocal ? { "x-voting-token": tokenLocal } : undefined,
    }).catch(() => null)

    if (!res?.ok) return

    const respuesta = await res.json().catch(() => null)
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
  ])

  useEffect(() => {
    cargarVotacionActivaRef.current = cargarVotacionActiva
  }, [cargarVotacionActiva])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarVotacionActiva()
    })
  }, [cargarVotacionActiva])

  useEffect(() => {
    if (!asambleaId) return

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
        () => cargarVotacionActivaRef.current()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalVotaciones)
    }
  }, [asambleaId])

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
        () => cargarVotacionActivaRef.current()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalCandidatos)
    }
  }, [opciones.modoAsambleista, votacionId])

  useEffect(() => {
    if (!asambleaId) return

    const refresco = window.setInterval(() => {
      cargarVotacionActivaRef.current()
    }, opciones.modoAsambleista ? 5000 : 3000)

    return () => window.clearInterval(refresco)
  }, [asambleaId, opciones.modoAsambleista])

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
