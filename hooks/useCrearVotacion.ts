import { useState } from "react"

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

    const respuesta = await fetch("/api/moderador/votaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asambleaId,
        titulo: nuevoTitulo.trim(),
        tipoMayoria: nuevoTipoMayoria,
        tipoVotacion: nuevoTipoVotacion,
        tipoMocion: nuevoTipoMocion,
        mocionPadreId: nuevaMocionPadreId || null,
        resolucionRaizId: nuevaResolucionRaizId || null,
        candidatos: candidatosLimpios,
      }),
    })

    const resultado = await respuesta.json().catch(() => null)

    if (!respuesta.ok || !resultado?.ok) {
      alert(resultado?.error || "No se pudo crear la votación")
      return false
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
