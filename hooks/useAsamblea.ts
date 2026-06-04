import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { supabase } from "@/lib/supabaseClient"
import { generarReporteCierreAsamblea } from "@/lib/reporteAsamblea"

type AsambleaContextValue = ReturnType<typeof useAsambleaState>

const AsambleaContext = createContext<AsambleaContextValue | null>(null)

function useAsambleaState() {
  const [asambleaId, setAsambleaId] = useState<string | null>(null)
  const [anioAsamblea, setAnioAsamblea] = useState("")
  const [lugarAsamblea, setLugarAsamblea] = useState("")
  const [organizacionAsamblea, setOrganizacionAsamblea] = useState("")
  const [estadoAsamblea, setEstadoAsamblea] = useState<"abierta" | "receso" | "cerrada">("cerrada")
  const [nuevoAnio, setNuevoAnio] = useState("")
  const [nuevoLugar, setNuevoLugar] = useState("")
  const [nuevaOrganizacion, setNuevaOrganizacion] = useState("")
  const [organizacionIdSesion, setOrganizacionIdSesion] = useState<string | null>(null)
  const [organizacionSlugSesion, setOrganizacionSlugSesion] = useState("kingdom-tech-group")
  const [organizacionNombreSesion, setOrganizacionNombreSesion] = useState("Kingdom Tech Group")

  const cargarOrganizacionSesion = useCallback(async () => {
    const slugUrl =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("org") || ""
        : ""
    const slugGuardado =
      typeof window !== "undefined" ? localStorage.getItem("organizacion_slug") || "" : ""

    if (slugUrl) {
      localStorage.setItem("organizacion_slug", slugUrl)
      setOrganizacionSlugSesion(slugUrl)
    } else if (slugGuardado) {
      setOrganizacionSlugSesion(slugGuardado)
    }

    const res = await fetch("/api/auth/me").catch(() => null)

    if (!res?.ok) return

    const data = await res.json().catch(() => null)

    if (data?.organizacion) {
      const tenant = {
        id: data.organizacion.id || null,
        nombre: data.organizacion.nombre || "Kingdom Tech Group",
        slug: data.organizacion.slug || slugUrl || slugGuardado || "kingdom-tech-group",
      }

      setOrganizacionIdSesion(data.organizacion.id || null)
      setOrganizacionNombreSesion(tenant.nombre)
      setOrganizacionSlugSesion(tenant.slug)

      return tenant
    }

    const fallback = {
      id: null,
      nombre: "Kingdom Tech Group",
      slug: slugUrl || slugGuardado || "kingdom-tech-group",
    }

    setOrganizacionNombreSesion(fallback.nombre)
    return fallback
  }, [])

  const cargarAsambleaActiva = useCallback(async (tenantSesion?: {
    id: string | null
    slug: string
  }) => {
    let query = supabase
      .from("asambleas")
      .select("*")
      .in("estado", ["abierta", "receso"])

    const tenantId = tenantSesion?.id ?? organizacionIdSesion
    const tenantSlug = tenantSesion?.slug ?? organizacionSlugSesion

    if (tenantId) {
      query = query.eq("organizacion_id", tenantId)
    } else if (tenantSlug) {
      query = query.eq("organizacion_slug", tenantSlug)
    }

    const { data, error } = await query.maybeSingle()

    if (error || !data) {
      setAsambleaId(null)
      setAnioAsamblea("")
      setLugarAsamblea("")
      setOrganizacionAsamblea("")
      setEstadoAsamblea("cerrada")
      return
    }

    setAsambleaId(data.id)
    setAnioAsamblea(String(data.anio))
    setLugarAsamblea(data.lugar)
    setOrganizacionAsamblea(data.organizacion || "")
    setEstadoAsamblea(data.estado === "receso" ? "receso" : "abierta")
  }, [organizacionIdSesion, organizacionSlugSesion])

  const registrarEventoAsamblea = async (
    tipo: "receso_iniciado" | "trabajos_reanudados",
    descripcion: string
  ) => {
    if (!asambleaId) return true

    const { error } = await supabase.from("asamblea_eventos").insert({
      asamblea_id: asambleaId,
      tipo,
      descripcion,
    })

    if (error) {
      if (error.message.includes("asamblea_eventos")) {
        alert(
          "La asamblea cambió de estado, pero falta crear la tabla de eventos en Supabase. Ejecuta el archivo supabase-asambleas-receso.sql para que los recesos salgan en el informe."
        )
      } else {
        alert(`La asamblea cambió de estado, pero no se pudo registrar el evento en el acta: ${error.message}`)
      }

      return false
    }

    return true
  }

  const abrirAsamblea = async () => {
    if (!nuevaOrganizacion.trim() || !nuevoAnio.trim() || !nuevoLugar.trim()) return

    let cerrarActivas = supabase
      .from("asambleas")
      .update({ estado: "cerrada" })
      .in("estado", ["abierta", "receso"])

    if (organizacionIdSesion) {
      cerrarActivas = cerrarActivas.eq("organizacion_id", organizacionIdSesion)
    } else if (organizacionSlugSesion) {
      cerrarActivas = cerrarActivas.eq("organizacion_slug", organizacionSlugSesion)
    }

    await cerrarActivas

    const { error } = await supabase.from("asambleas").insert([
      {
        organizacion_id: organizacionIdSesion,
        organizacion_slug: organizacionSlugSesion,
        organizacion: nuevaOrganizacion.trim(),
        anio: Number(nuevoAnio),
        lugar: nuevoLugar.trim(),
        estado: "abierta",
      },
    ])

    if (error) {
      alert(error.message)
      return
    }

    setNuevaOrganizacion("")
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

  const ponerAsambleaEnReceso = async () => {
    if (!asambleaId) {
      alert("No hay asamblea activa")
      return false
    }

    if (estadoAsamblea === "receso") {
      alert("La asamblea ya está en receso")
      return false
    }

    const { data: votacionAbierta, error: errorVotacion } = await supabase
      .from("votaciones")
      .select("id, titulo")
      .eq("asamblea_id", asambleaId)
      .eq("estado", "abierta")
      .limit(1)
      .maybeSingle()

    if (errorVotacion) {
      alert(errorVotacion.message)
      return false
    }

    if (votacionAbierta) {
      alert(
        `Debe cerrar la votación activa antes de poner la asamblea en receso: ${votacionAbierta.titulo}`
      )
      return false
    }

    const confirmar = window.confirm(
      "¿Poner la asamblea en receso? Puerta y Oficina seguirán funcionando, pero no se podrán abrir votaciones hasta reanudar."
    )

    if (!confirmar) return false

    const { error } = await supabase
      .from("asambleas")
      .update({ estado: "receso" })
      .eq("id", asambleaId)

    if (error) {
      alert(error.message)
      return false
    }

    await registrarEventoAsamblea("receso_iniciado", "Trabajos puestos en receso")
    await cargarAsambleaActiva()
    alert("Asamblea en receso")
    return true
  }

  const reanudarAsamblea = async () => {
    if (!asambleaId) {
      alert("No hay asamblea activa")
      return false
    }

    if (estadoAsamblea !== "receso") {
      alert("La asamblea no está en receso")
      return false
    }

    const { error } = await supabase
      .from("asambleas")
      .update({ estado: "abierta" })
      .eq("id", asambleaId)

    if (error) {
      alert(error.message)
      return false
    }

    await registrarEventoAsamblea("trabajos_reanudados", "Trabajos reanudados")
    await cargarAsambleaActiva()
    alert("Trabajos reanudados")
    return true
  }

  const cerrarAsambleaLocal = () => {
    setAsambleaId(null)
    setAnioAsamblea("")
    setLugarAsamblea("")
    setOrganizacionAsamblea("")
    setEstadoAsamblea("cerrada")
  }

  useEffect(() => {
    queueMicrotask(() => {
      void (async () => {
        const tenant = await cargarOrganizacionSesion()
        await cargarAsambleaActiva(tenant || undefined)
      })()
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
  }, [cargarAsambleaActiva, cargarOrganizacionSesion])

  return {
    asambleaId,
    anioAsamblea,
    lugarAsamblea,
    organizacionAsamblea,
    organizacionNombreSesion,
    estadoAsamblea,
    nuevoAnio,
    nuevoLugar,
    nuevaOrganizacion,
    organizacionIdSesion,
    organizacionSlugSesion,
    setNuevoAnio,
    setNuevoLugar,
    setNuevaOrganizacion,
    cargarAsambleaActiva,
    abrirAsamblea,
    cerrarAsamblea,
    ponerAsambleaEnReceso,
    reanudarAsamblea,
    cerrarAsambleaLocal,
  }
}

export function AsambleaProvider({ children }: { children: ReactNode }) {
  const value = useAsambleaState()

  return createElement(AsambleaContext.Provider, { value }, children)
}

export function useAsamblea() {
  const context = useContext(AsambleaContext)
  const fallback = useAsambleaState()

  return context || fallback
}
