import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { ConteoCandidato, ResultadoCerrado } from "@/lib/types"

export function useVotacion(asambleaId: string | null) {
  const [estado, setEstado] = useState("cerrada")
  const [votacionId, setVotacionId] = useState<string | null>(null)
  const [titulo, setTitulo] = useState("")
  const [tipoMayoria, setTipoMayoria] = useState("")
  const [tipoVotacion, setTipoVotacion] = useState("resolucion")
  const [publicada, setPublicada] = useState(false)

  const [candidatos, setCandidatos] = useState<any[]>([])
  const [conteoCandidatos, setConteoCandidatos] = useState<ConteoCandidato[]>([])

  const [votosEmitidos, setVotosEmitidos] = useState(0)
  const [votosAFavor, setVotosAFavor] = useState(0)
  const [votosEnContra, setVotosEnContra] = useState(0)
  const [yaVoto, setYaVoto] = useState(false)

  const [resultadosCerrados, setResultadosCerrados] = useState<ResultadoCerrado[]>([])

  const cargarVotacionActivaRef = useRef<() => void>(() => {})

  const limpiarVotacion = useCallback(() => {
    setEstado("cerrada")
    setVotacionId(null)
    setTitulo("")
    setTipoMayoria("")
    setTipoVotacion("resolucion")
    setPublicada(false)
    setCandidatos([])
    setConteoCandidatos([])
    setVotosEmitidos(0)
    setVotosAFavor(0)
    setVotosEnContra(0)
    setYaVoto(false)
  }, [])

  const cargarVotacionActiva = useCallback(async () => {
    if (!asambleaId) {
      limpiarVotacion()
      return
    }

    let { data, error } = await supabase
      .from("votaciones")
      .select("*")
      .eq("asamblea_id", asambleaId)
      .eq("estado", "abierta")
      .order("creada_en", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data) {
      const resultadoCerrada = await supabase
        .from("votaciones")
        .select("*")
        .eq("asamblea_id", asambleaId)
        .eq("estado", "cerrada")
        .order("creada_en", { ascending: false })
        .limit(1)
        .maybeSingle()

      data = resultadoCerrada.data
      error = resultadoCerrada.error
    }

    if (error || !data) {
      limpiarVotacion()
      return
    }

    setEstado(data.estado)
    setVotacionId(data.id)
    setTitulo(data.titulo)
    setTipoMayoria(data.tipo_mayoria || "")
    setTipoVotacion(data.tipo_votacion || "resolucion")
    setPublicada(data.publicada || false)

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

    setVotosAFavor(votosFavor)
    setVotosEnContra(votosContra)

    if (data.tipo_votacion === "eleccion_lideres") {
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
  }, [asambleaId, limpiarVotacion])

  useEffect(() => {
    cargarVotacionActivaRef.current = cargarVotacionActiva
  }, [cargarVotacionActiva])

  useEffect(() => {
    cargarVotacionActiva()
  }, [cargarVotacionActiva])

  useEffect(() => {
    if (!asambleaId) return

    const canalVotaciones = supabase
      .channel(`realtime-votaciones-${asambleaId}`)
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
      .channel(`realtime-votos-${votacionId}`)
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
      .channel(`realtime-candidatos-${votacionId}`)
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
    publicada,
    setPublicada,
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
    yaVoto,
    setYaVoto,
    resultadosCerrados,
    setResultadosCerrados,
    cargarVotacionActiva,
  }
}