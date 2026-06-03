import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { Candidato, ConteoCandidato, ResultadoCerrado } from "@/lib/types"

export function useVotacion(
  asambleaId: string | null,
  opciones: { ocultarCandidatosPrimeraRonda?: boolean } = {}
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

    const { data, error } = await supabase
      .from("votaciones")
      .select("*")
      .eq("asamblea_id", asambleaId)
      .eq("estado", "abierta")
      .order("creada_en", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
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

    const { data: votosData } = await supabase
      .from("votos")
      .select("*")
      .eq("votacion_id", data.id)

    const votos = votosData || []

    setVotosEmitidos(votos.length)

    const tokenLocal =
      typeof window !== "undefined"
        ? localStorage.getItem("token_votacion")
        : null

    if (tokenLocal) {
      const { data: tokenRow } = await supabase
        .from("tokens_acceso")
        .select("id")
        .eq("token_hash", tokenLocal)
        .maybeSingle()

      if (tokenRow) {
        const yaVotoUsuario = votos.some((voto) => voto.token_id === tokenRow.id)
        setYaVoto(yaVotoUsuario)
      } else {
        setYaVoto(false)
      }
    } else {
      setYaVoto(false)
    }

    const votosFavor = votos.filter((voto) => voto.opcion === "favor").length
    const votosContra = votos.filter((voto) => voto.opcion === "contra").length
    const abstenciones = votos.filter((voto) => voto.opcion === "abstencion").length

    setVotosAFavor(votosFavor)
    setVotosEnContra(votosContra)
    setVotosAbstencion(abstenciones)

    if (
      data.tipo_votacion === "eleccion_lideres" &&
      !(opciones.ocultarCandidatosPrimeraRonda && (data.ronda_numero || 1) === 1)
    ) {
      const { data: candidatosData } = await supabase
        .from("candidatos")
        .select("*")
        .eq("votacion_id", data.id)
        .order("nombre", { ascending: true })

      const totalVotos = votos.length

      const candidatosConConteo = (candidatosData || []).map((candidato) => {
        const votosDelCandidato = votos.filter(
          (voto) => String(voto.candidato_id) === String(candidato.id)
        ).length

        const porcentaje =
          totalVotos > 0
            ? Number(((votosDelCandidato / totalVotos) * 100).toFixed(2))
            : 0

        return {
          votos: votosDelCandidato,
          porcentaje,
          ...candidato,
        }
      })

      setCandidatos(candidatosData || [])
      setConteoCandidatos(candidatosConConteo)
    } else {
      setCandidatos([])
      setConteoCandidatos([])
    }
  }, [asambleaId, limpiarVotacion, opciones.ocultarCandidatosPrimeraRonda])

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

    const canalVotos = supabase
      .channel(`realtime-votos-${votacionId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",

          table: "votos",
          filter: `votacion_id=eq.${votacionId}`,
        },
        () => {
          cargarVotacionActivaRef.current()
        }
      )
      .subscribe()

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
      supabase.removeChannel(canalVotos)
      supabase.removeChannel(canalCandidatos)
    }
  }, [votacionId])

  useEffect(() => {
    if (!votacionId || estado !== "abierta") return

    const refresco = window.setInterval(() => {
      cargarVotacionActivaRef.current()
    }, 3000)

    return () => window.clearInterval(refresco)
  }, [votacionId, estado])

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
