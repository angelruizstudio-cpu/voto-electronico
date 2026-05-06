import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export function useCrearVotacion(
  asambleaId: string | null,
  cargarVotacionActiva: () => Promise<void>
) {
  const [nuevoTitulo, setNuevoTitulo] = useState("")
  const [nuevoTipoMayoria, setNuevoTipoMayoria] = useState("mayoria_simple")
  const [nuevoTipoVotacion, setNuevoTipoVotacion] = useState("resolucion")
  const [candidatosInput, setCandidatosInput] = useState<string[]>(["", ""])

  const crearVotacion = async () => {
    if (!asambleaId) {
      alert("Primero debes abrir una asamblea")
      return
    }

    if (!nuevoTitulo.trim()) {
      alert("Escribe un título para la votación")
      return
    }

    const candidatosLimpios = candidatosInput
      .map((c) => c.trim())
      .filter((c) => c.length > 0)

    if (nuevoTipoVotacion === "eleccion_lideres" && candidatosLimpios.length < 2) {
      alert("Debes añadir al menos 2 candidatos")
      return
    }

    const { data: votacionCreada, error: errorVotacion } = await supabase
      .from("votaciones")
      .insert({
        titulo: nuevoTitulo.trim(),
        asamblea_id: asambleaId,
        estado: "abierta",
        tipo_mayoria:
          nuevoTipoVotacion === "resolucion" ? nuevoTipoMayoria : "mayoria_simple",
        tipo_votacion: nuevoTipoVotacion,
        publicada: false,
      })
      .select()
      .single()

    if (errorVotacion || !votacionCreada) {
      alert(errorVotacion?.message || "No se pudo crear la votación")
      return
    }

    if (nuevoTipoVotacion === "eleccion_lideres") {
      const candidatosParaInsertar = candidatosLimpios.map((nombre) => ({
        votacion_id: votacionCreada.id,
        nombre,
      }))

      const { error: errorCandidatos } = await supabase
        .from("candidatos")
        .insert(candidatosParaInsertar)

      if (errorCandidatos) {
        alert(errorCandidatos.message)
        return
      }
    }

    setNuevoTitulo("")
    setNuevoTipoMayoria("mayoria_simple")
    setNuevoTipoVotacion("resolucion")
    setCandidatosInput(["", ""])

    await new Promise((res) => setTimeout(res, 500))
    await cargarVotacionActiva()

    alert("Votación creada")
  }

  return {
    nuevoTitulo,
    setNuevoTitulo,
    nuevoTipoMayoria,
    setNuevoTipoMayoria,
    nuevoTipoVotacion,
    setNuevoTipoVotacion,
    candidatosInput,
    setCandidatosInput,
    crearVotacion,
  }
}