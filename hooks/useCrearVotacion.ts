import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export function useCrearVotacion(
  asambleaId: string | null,
  cargarVotacionActiva: () => Promise<void>
) {
  const [nuevoTitulo, setNuevoTitulo] = useState("")
  const [nuevoTipoMayoria, setNuevoTipoMayoria] = useState("mayoria_simple")
  const [nuevoTipoVotacion, setNuevoTipoVotacion] = useState("resolucion")
  const [nuevoTipoMocion, setNuevoTipoMocion] = useState("resolucion_principal")
  const [nuevaMocionPadreId, setNuevaMocionPadreId] = useState("")
  const [nuevaResolucionRaizId, setNuevaResolucionRaizId] = useState("")
  const [candidatosInput, setCandidatosInput] = useState<string[]>(["", ""])

  const crearVotacion = async () => {
    if (!asambleaId) {
      alert("Primero debes abrir una asamblea")
      return false
    }

    if (!nuevoTitulo.trim()) {
      alert("Escribe un título para la votación")
      return false
    }

    const candidatosLimpios = candidatosInput
      .map((c) => c.trim())
      .filter((c) => c.length > 0)

    if (nuevoTipoVotacion === "eleccion_lideres" && candidatosLimpios.length < 2) {
      alert("Debes añadir al menos 2 candidatos")
      return false
    }

    if (
      nuevoTipoVotacion === "resolucion" &&
      nuevoTipoMocion !== "resolucion_principal" &&
      !nuevaMocionPadreId
    ) {
      alert("Selecciona la moción que será enmendada")
      return false
    }

    const datosVotacion = {
      titulo: nuevoTitulo.trim(),
      asamblea_id: asambleaId,
      estado: nuevoTipoVotacion === "resolucion" ? "cerrada" : "abierta",
      tipo_mayoria:
        nuevoTipoVotacion === "resolucion" ? nuevoTipoMayoria : "mayoria_simple",
      tipo_votacion: nuevoTipoVotacion,
      publicada: false,
      ronda_numero: nuevoTipoVotacion === "eleccion_lideres" ? 1 : null,
      estado_parlamentario:
        nuevoTipoVotacion === "resolucion" ? "esperando_segundo" : null,
      tipo_mocion:
        nuevoTipoVotacion === "resolucion" ? nuevoTipoMocion : null,
      mocion_padre_id:
        nuevoTipoVotacion === "resolucion" && nuevaMocionPadreId
          ? nuevaMocionPadreId
          : null,
      resolucion_raiz_id:
        nuevoTipoVotacion === "resolucion" && nuevoTipoMocion !== "resolucion_principal"
          ? nuevaResolucionRaizId || nuevaMocionPadreId
          : null,
    }

    const { data: votacionCreada, error: errorVotacion } = await supabase
      .from("votaciones")
      .insert(datosVotacion)
      .select()
      .single()

    if (errorVotacion || !votacionCreada) {
      alert(errorVotacion?.message || "No se pudo crear la votación")
      return false
    }

    if (
      nuevoTipoVotacion === "resolucion" &&
      nuevoTipoMocion === "resolucion_principal"
    ) {
      const { error: errorRaiz } = await supabase
        .from("votaciones")
        .update({ resolucion_raiz_id: votacionCreada.id })
        .eq("id", votacionCreada.id)

      if (errorRaiz) {
        alert(errorRaiz.message)
        return false
      }
    }

    if (nuevoTipoVotacion === "eleccion_lideres") {
      await supabase
        .from("votaciones")
        .update({ eleccion_grupo_id: votacionCreada.id })
        .eq("id", votacionCreada.id)

      const candidatosParaInsertar = candidatosLimpios.map((nombre) => ({
        votacion_id: votacionCreada.id,
        nombre,
      }))

      const { error: errorCandidatos } = await supabase
        .from("candidatos")
        .insert(candidatosParaInsertar)

      if (errorCandidatos) {
        alert(errorCandidatos.message)
        return false
      }
    }

    setNuevoTitulo("")
    setNuevoTipoMayoria("mayoria_simple")
    setNuevoTipoVotacion("resolucion")
    setNuevoTipoMocion("resolucion_principal")
    setNuevaMocionPadreId("")
    setNuevaResolucionRaizId("")
    setCandidatosInput(["", ""])

    await new Promise((res) => setTimeout(res, 500))
    await cargarVotacionActiva()

    alert(nuevoTipoVotacion === "resolucion" ? "Moción presentada" : "Votación creada")
    return true
  }

  return {
    nuevoTitulo,
    setNuevoTitulo,
    nuevoTipoMayoria,
    setNuevoTipoMayoria,
    nuevoTipoVotacion,
    setNuevoTipoVotacion,
    nuevoTipoMocion,
    setNuevoTipoMocion,
    nuevaMocionPadreId,
    setNuevaMocionPadreId,
    nuevaResolucionRaizId,
    setNuevaResolucionRaizId,
    candidatosInput,
    setCandidatosInput,
    crearVotacion,
  }
}
