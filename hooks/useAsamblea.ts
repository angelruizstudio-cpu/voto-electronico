import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export function useAsamblea() {
  const [asambleaId, setAsambleaId] = useState<string | null>(null)
  const [anioAsamblea, setAnioAsamblea] = useState("")
  const [lugarAsamblea, setLugarAsamblea] = useState("")
  const [nuevoAnio, setNuevoAnio] = useState("")
  const [nuevoLugar, setNuevoLugar] = useState("")

  const cargarAsambleaActiva = async () => {
    const { data, error } = await supabase
      .from("asambleas")
      .select("*")
      .eq("estado", "abierta")
      .maybeSingle()

    if (error || !data) {
      setAsambleaId(null)
      setAnioAsamblea("")
      setLugarAsamblea("")
      return
    }

    setAsambleaId(data.id)
    setAnioAsamblea(String(data.anio))
    setLugarAsamblea(data.lugar)
  }

  const abrirAsamblea = async () => {
    if (!nuevoAnio.trim() || !nuevoLugar.trim()) return

    await supabase
      .from("asambleas")
      .update({ estado: "cerrada" })
      .eq("estado", "abierta")

    const { error } = await supabase.from("asambleas").insert([
      {
        anio: Number(nuevoAnio),
        lugar: nuevoLugar,
        estado: "abierta",
      },
    ])

    if (error) {
      alert(error.message)
      return
    }

    setNuevoAnio("")
    setNuevoLugar("")
    await cargarAsambleaActiva()
  }

  const cerrarAsambleaLocal = () => {
    setAsambleaId(null)
    setAnioAsamblea("")
    setLugarAsamblea("")
  }

  useEffect(() => {
    cargarAsambleaActiva()
  }, [])

  return {
    asambleaId,
    anioAsamblea,
    lugarAsamblea,
    nuevoAnio,
    nuevoLugar,
    setNuevoAnio,
    setNuevoLugar,
    cargarAsambleaActiva,
    abrirAsamblea,
    cerrarAsambleaLocal,
  }
}