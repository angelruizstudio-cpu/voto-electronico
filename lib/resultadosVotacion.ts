import type { SupabaseClient } from "@supabase/supabase-js"
import {
  calcularNecesarios,
  calcularVotosValidosCandidatos,
  obtenerGanadorMayoriaSimple,
} from "@/lib/votacionHelpers"

type VotacionResultado = {
  id: string
  titulo: string
  tipo_votacion: string
  tipo_mayoria?: string | null
  ronda_numero?: number | null
  eleccion_grupo_id?: string | null
}

type Voto = {
  opcion: "favor" | "contra" | "abstencion" | "nula" | "danada" | null
  candidato_id: string | null
  cantidad?: number
}

export async function calcularResultadosVotacion(
  supabaseAdmin: SupabaseClient,
  votacion: VotacionResultado
) {
  const [respuestaVotos, respuestaManuales] = await Promise.all([
    supabaseAdmin.from("votos").select("opcion, candidato_id").eq("votacion_id", votacion.id),
    supabaseAdmin
      .from("votos_manuales")
      .select("opcion, candidato_id, cantidad")
      .eq("votacion_id", votacion.id),
  ])

  if (respuestaVotos.error) return { resultado: null, error: respuestaVotos.error }
  if (respuestaManuales.error) return { resultado: null, error: respuestaManuales.error }

  const votos = (respuestaVotos.data || []) as Voto[]
  const votosManuales = (respuestaManuales.data || []) as Voto[]
  const manuales = votosManuales.reduce((total, voto) => total + (voto.cantidad || 0), 0)
  const electronicos = votos.length
  const emitidos = electronicos + manuales
  const nulas = votosManuales.find((voto) => voto.opcion === "nula")?.cantidad || 0
  const danadas = votosManuales.find((voto) => voto.opcion === "danada")?.cantidad || 0

  if (votacion.tipo_votacion === "eleccion_lideres") {
    const { data, error } = await supabaseAdmin
      .from("candidatos")
      .select("id, nombre")
      .eq("votacion_id", votacion.id)
      .order("nombre", { ascending: true })

    if (error) return { resultado: null, error }

    const candidatos = (data || [])
      .map((candidato) => {
        const votosElectronicos = votos.filter(
          (voto) => String(voto.candidato_id) === String(candidato.id)
        ).length
        const votosManualesCandidato = votosManuales
          .filter((voto) => String(voto.candidato_id) === String(candidato.id))
          .reduce((total, voto) => total + (voto.cantidad || 0), 0)
        const total = votosElectronicos + votosManualesCandidato

        return {
          id: candidato.id,
          nombre: candidato.nombre,
          electronicos: votosElectronicos,
          manuales: votosManualesCandidato,
          votos: total,
          porcentaje: emitidos > 0 ? Number(((total / emitidos) * 100).toFixed(2)) : 0,
        }
      })
      .sort((a, b) => b.votos - a.votos)
    const validos = calcularVotosValidosCandidatos(candidatos)
    const necesarios = calcularNecesarios(validos, "mayoria_simple")
    const ganador = obtenerGanadorMayoriaSimple(candidatos)
    const empateSorteo =
      (votacion.ronda_numero || 1) >= 3 &&
      candidatos.filter((candidato) => candidato.votos > 0).length === 2 &&
      validos > 0 &&
      candidatos[0]?.votos === candidatos[1]?.votos

    return {
      resultado: {
        tipo: "eleccion_lideres",
        votacionId: votacion.id,
        titulo: votacion.titulo,
        emitidos,
        electronicos,
        manuales,
        necesarios,
        nulas,
        danadas,
        rondaNumero: votacion.ronda_numero || 1,
        eleccionGrupoId: votacion.eleccion_grupo_id || votacion.id,
        resultado: ganador
          ? "electo"
          : empateSorteo
          ? "empate_sorteo"
          : emitidos > 0 && (votacion.ronda_numero || 1) < 3
          ? "requiere_nueva_ronda"
          : "sin_eleccion",
        ganadorId: ganador?.id || null,
        ganadorNombre: ganador?.nombre || null,
        candidatos,
      },
      error: null,
    }
  }

  const favorElectronico = votos.filter((voto) => voto.opcion === "favor").length
  const contraElectronico = votos.filter((voto) => voto.opcion === "contra").length
  const abstencionElectronica = votos.filter((voto) => voto.opcion === "abstencion").length
  const favorManual = votosManuales.find((voto) => voto.opcion === "favor")?.cantidad || 0
  const contraManual = votosManuales.find((voto) => voto.opcion === "contra")?.cantidad || 0
  const abstencionManual =
    votosManuales.find((voto) => voto.opcion === "abstencion")?.cantidad || 0
  const favor = favorElectronico + favorManual
  const contra = contraElectronico + contraManual
  const abstencion = abstencionElectronica + abstencionManual
  const validos = favor + contra
  const necesarios = calcularNecesarios(validos, votacion.tipo_mayoria || "mayoria_simple")

  return {
    resultado: {
      tipo: "resolucion",
      votacionId: votacion.id,
      titulo: votacion.titulo,
      emitidos,
      electronicos,
      manuales,
      favor,
      contra,
      abstencion,
      favorElectronico,
      contraElectronico,
      abstencionElectronica,
      favorManual,
      contraManual,
      abstencionManual,
      validos,
      necesarios,
      resultado: validos > 0 && favor >= necesarios ? "aprobada" : "rechazada",
    },
    error: null,
  }
}
