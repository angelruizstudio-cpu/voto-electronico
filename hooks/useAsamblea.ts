import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { generarReporteCierreAsamblea } from "@/lib/reporteAsamblea"

export function useAsamblea() {
  const [asambleaId, setAsambleaId] = useState<string | null>(null)
  const [anioAsamblea, setAnioAsamblea] = useState("")
  const [lugarAsamblea, setLugarAsamblea] = useState("")
  const [nuevoAnio, setNuevoAnio] = useState("")
  const [nuevoLugar, setNuevoLugar] = useState("")

  const cargarAsambleaActiva = useCallback(async () => {
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
  }, [])

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

  const cerrarAsamblea = async () => {
    if (!asambleaId) {
      alert("No hay asamblea activa")
      return false
    }

    const confirmar = window.confirm(
      "¿Cerrar los trabajos de la asamblea? Esta acción cerrará votaciones abiertas y marcará la asamblea como cerrada."
    )

    if (!confirmar) return false

    await supabase
      .from("votaciones")
      .update({ estado: "cerrada" })
      .eq("asamblea_id", asambleaId)
      .eq("estado", "abierta")

    await supabase
      .from("asambleistas")
      .update({
        presente: false,
        check_out_en: new Date().toISOString(),
      })
      .eq("asamblea_id", asambleaId)
      .eq("presente", true)

    const { error } = await supabase
      .from("asambleas")
      .update({ estado: "cerrada" })
      .eq("id", asambleaId)

    if (error) {
      alert(error.message)
      return false
    }

    try {
      await generarReporteCierreAsamblea(asambleaId)
    } catch (reporteError) {
      cerrarAsambleaLocal()
      alert(
        reporteError instanceof Error
          ? `La asamblea fue cerrada, pero no se pudo generar el PDF: ${reporteError.message}`
          : "La asamblea fue cerrada, pero no se pudo generar el PDF"
      )
      return true
    }

    cerrarAsambleaLocal()
    alert("Asamblea cerrada y PDF generado")
    return true
  }

  const cerrarAsambleaLocal = () => {
    setAsambleaId(null)
    setAnioAsamblea("")
    setLugarAsamblea("")
  }

  useEffect(() => {
    queueMicrotask(() => {
      void cargarAsambleaActiva()
    })

    const canalAsambleas = supabase
      .channel(`realtime-asamblea-activa-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "asambleas",
        },
        () => {
          void cargarAsambleaActiva()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalAsambleas)
    }
  }, [cargarAsambleaActiva])

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
    cerrarAsamblea,
    cerrarAsambleaLocal,
  }
}
