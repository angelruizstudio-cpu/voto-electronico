"use client"

import { supabase } from "@/lib/supabaseClient"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { enviarVoto } from "@/lib/voteApi"
import { getDeviceId } from "@/lib/deviceId"

type ResultadoCerrado = {
  id: string
  titulo: string
  tipo_mayoria: string
  tipo_votacion: string
  votosEmitidos: number
  votosAFavor: number
  votosEnContra: number
  votosNecesarios: number
  aprobado: boolean
  ganadorNombre?: string
  resultado?: string
}

type Candidato = {
  id: string
  nombre: string
}

type ConteoCandidato = {
  id: string
  nombre: string
  votos: number
}

export default function Dashboard() {
  const [asambleaId, setAsambleaId] = useState<string | null>(null)
  const [anioAsamblea, setAnioAsamblea] = useState("")
  const [lugarAsamblea, setLugarAsamblea] = useState("")
  const [nuevoAnio, setNuevoAnio] = useState("")
  const [nuevoLugar, setNuevoLugar] = useState("")

  const [estado, setEstado] = useState("cerrada")
  const [votacionId, setVotacionId] = useState<string | null>(null)
  const [titulo, setTitulo] = useState("")
  const [tipoMayoria, setTipoMayoria] = useState("")
  const [tipoVotacion, setTipoVotacion] = useState("resolucion")
  const [ronda, setRonda] = useState(1)

  const [nuevoTitulo, setNuevoTitulo] = useState("")
  const [nuevoTipoMayoria, setNuevoTipoMayoria] = useState("mayoria_simple")
  const [nuevoTipoVotacion, setNuevoTipoVotacion] = useState("resolucion")
  const [candidatosInput, setCandidatosInput] = useState<string[]>([""])

  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [conteoCandidatos, setConteoCandidatos] = useState<ConteoCandidato[]>([])

  const [votosEmitidos, setVotosEmitidos] = useState(0)
  const [votosAFavor, setVotosAFavor] = useState(0)
  const [votosEnContra, setVotosEnContra] = useState(0)
  const [yaVoto, setYaVoto] = useState(false)
  const [resultadosCerrados, setResultadosCerrados] = useState<ResultadoCerrado[]>([])

  const TOKEN_PRUEBA = "73aa5ce855193248c6b92e518afd5c0e"

  const calcularNecesarios = (total: number, tipo: string) => {
    if (total === 0) return 0
    if (tipo === "dos_tercios") return Math.ceil((2 / 3) * total)
    return Math.floor(total / 2) + 1
  }

  const votosNecesarios = calcularNecesarios(votosEmitidos, tipoMayoria)
  const aprobado = votosAFavor >= votosNecesarios && votosEmitidos > 0

  const rankingCandidatos = [...conteoCandidatos].sort((a, b) => b.votos - a.votos)
  const ganadorActual = rankingCandidatos[0] || null
  const ganadorTieneMayoria =
    !!ganadorActual && ganadorActual.votos >= votosNecesarios && votosEmitidos > 0

  const mostrarTipoMayoria = (tipo: string) => {
    if (tipo === "dos_tercios") return "Dos terceras partes"
    return "Mayoría simple"
  }

  const mostrarTipoVotacion = (tipo: string) => {
    if (tipo === "eleccion_lideres") return "Elección de Líderes Regionales"
    return "Resolución"
  }

  const claseRanking = (index: number) => {
    if (index === 0) return "bg-green-100 border-green-300"
    if (index === 1) return "bg-yellow-100 border-yellow-300"
    if (index === 2) return "bg-orange-100 border-orange-300"
    return "bg-white"
  }

  const actualizarCandidatoInput = (index: number, valor: string) => {
    const copia = [...candidatosInput]
    copia[index] = valor
    setCandidatosInput(copia)
  }

  const agregarCampoCandidato = () => {
    setCandidatosInput([...candidatosInput, ""])
  }

  const eliminarCampoCandidato = (index: number) => {
    const copia = candidatosInput.filter((_, i) => i !== index)
    setCandidatosInput(copia.length > 0 ? copia : [""])
  }

  const cargarAsambleaActiva = async () => {
    const { data, error } = await supabase
      .from("asambleas")
      .select("*")
      .eq("estado", "abierta")
      .single()

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

    await supabase.from("asambleas").update({ estado: "cerrada" }).eq("estado", "abierta")

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

  const cargarVotacionActiva = async () => {
    if (!asambleaId) return

    const { data, error } = await supabase
      .from("votaciones")
      .select("*")
      .eq("estado", "abierta")
      .eq("asamblea_id", asambleaId)
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      setEstado("cerrada")
      setVotacionId(null)
      setTitulo("")
      setTipoMayoria("")
      setTipoVotacion("resolucion")
      setRonda(1)
      setCandidatos([])
      setConteoCandidatos([])
      setVotosEmitidos(0)
      setVotosAFavor(0)
      setVotosEnContra(0)
      return
    }

    setVotacionId(data.id)
    setTitulo(data.titulo)
    setTipoMayoria(data.tipo_mayoria)
    setTipoVotacion(data.tipo_votacion || "resolucion")
    setRonda(data.ronda || 1)
    setEstado("abierta")
  }

  const cargarCandidatos = async (id: string) => {
    const { data, error } = await supabase
      .from("candidatos")
      .select("*")
      .eq("votacion_id", id)
      .order("nombre", { ascending: true })

    if (error || !data) {
      setCandidatos([])
      return
    }

    setCandidatos(data)
  }

  const cargarConteoCandidatos = async (id: string) => {
    const { data: candidatosData } = await supabase
      .from("candidatos")
      .select("*")
      .eq("votacion_id", id)
      .order("nombre", { ascending: true })

    const { data: votosData } = await supabase.from("votos").select("*").eq("votacion_id", id)

    const conteo =
      candidatosData?.map((candidato) => ({
        id: candidato.id,
        nombre: candidato.nombre,
        votos: votosData?.filter((voto) => voto.candidato_id === candidato.id).length || 0,
      })) || []

    setConteoCandidatos(conteo)
  }

  const cargarVotos = async (id: string) => {
    const { data, error } = await supabase.from("votos").select("*").eq("votacion_id", id)

    if (error || !data) return

    setVotosEmitidos(data.length)
    setVotosAFavor(data.filter((v) => v.opcion === "favor").length)
    setVotosEnContra(data.filter((v) => v.opcion === "contra").length)

    await cargarConteoCandidatos(id)
  }

  const cargarResultadosCerrados = async () => {
    if (!asambleaId) {
      setResultadosCerrados([])
      return
    }

    const { data: votaciones, error } = await supabase
      .from("votaciones")
      .select("*")
      .eq("estado", "cerrada")
      .eq("asamblea_id", asambleaId)
      .order("titulo", { ascending: true })

    if (error || !votaciones) return

    const resultados = await Promise.all(
      votaciones.map(async (votacion) => {
        const { data: votos } = await supabase
          .from("votos")
          .select("*")
          .eq("votacion_id", votacion.id)

        const total = votos?.length || 0
        const favor = votos?.filter((v) => v.opcion === "favor").length || 0
        const contra = votos?.filter((v) => v.opcion === "contra").length || 0
        const necesarios = calcularNecesarios(total, votacion.tipo_mayoria)

        let ganadorNombre = ""
        let resultado = votacion.resultado || ""

        if (votacion.tipo_votacion === "eleccion_lideres" && votacion.ganador_id) {
          const { data: candidatoGanador } = await supabase
            .from("candidatos")
            .select("*")
            .eq("id", votacion.ganador_id)
            .maybeSingle()

          ganadorNombre = candidatoGanador?.nombre || ""
        }

        return {
          id: votacion.id,
          titulo: votacion.titulo,
          tipo_mayoria: votacion.tipo_mayoria,
          tipo_votacion: votacion.tipo_votacion || "resolucion",
          votosEmitidos: total,
          votosAFavor: favor,
          votosEnContra: contra,
          votosNecesarios: necesarios,
          aprobado: favor >= necesarios && total > 0,
          ganadorNombre,
          resultado,
        }
      })
    )

    setResultadosCerrados(resultados)
  }

  const crearVotacion = async () => {
    if (!asambleaId || !nuevoTitulo.trim()) return

    const candidatosLimpios = candidatosInput.map((c) => c.trim()).filter((c) => c.length > 0)

    if (nuevoTipoVotacion === "eleccion_lideres" && candidatosLimpios.length < 2) {
      alert("Debes añadir al menos dos candidatos.")
      return
    }

    await supabase
      .from("votaciones")
      .update({ estado: "cerrada" })
      .eq("estado", "abierta")
      .eq("asamblea_id", asambleaId)

    const tipoMayoriaFinal =
      nuevoTipoVotacion === "eleccion_lideres" ? "mayoria_simple" : nuevoTipoMayoria

    const { data: votacionCreada, error } = await supabase
      .from("votaciones")
      .insert([
        {
          titulo: nuevoTitulo,
          estado: "abierta",
          tipo_mayoria: tipoMayoriaFinal,
          tipo_votacion: nuevoTipoVotacion,
          asamblea_id: asambleaId,
          ronda: 1,
          resultado: null,
          ganador_id: null,
        },
      ])
      .select()
      .single()

    if (error || !votacionCreada) {
      alert(error?.message || "No se pudo crear la votación.")
      return
    }

    if (nuevoTipoVotacion === "eleccion_lideres") {
      const candidatosParaGuardar = candidatosLimpios.map((nombre) => ({
        votacion_id: votacionCreada.id,
        nombre,
      }))

      const { error: errorCandidatos } = await supabase.from("candidatos").insert(candidatosParaGuardar)

      if (errorCandidatos) {
        alert(errorCandidatos.message)
        return
      }
    }

    setNuevoTitulo("")
    setNuevoTipoMayoria("mayoria_simple")
    setNuevoTipoVotacion("resolucion")
    setCandidatosInput([""])

    await cargarVotacionActiva()
    await cargarResultadosCerrados()
  }

  const crearSiguienteRonda = async (
    candidatosSeleccionados: ConteoCandidato[],
    proximaRonda: number
  ) => {
    if (!asambleaId) return

    const tituloBase = titulo.replace(/ - Ronda \d+$/i, "")
    const nuevoTituloRonda = `${tituloBase} - Ronda ${proximaRonda}`

    const { data: nuevaVotacion, error } = await supabase
      .from("votaciones")
      .insert([
        {
          titulo: nuevoTituloRonda,
          estado: "abierta",
          tipo_mayoria: "mayoria_simple",
          tipo_votacion: "eleccion_lideres",
          asamblea_id: asambleaId,
          ronda: proximaRonda,
          resultado: null,
          ganador_id: null,
        },
      ])
      .select()
      .single()

    if (error || !nuevaVotacion) {
      alert(error?.message || "No se pudo crear la siguiente ronda.")
      return
    }

    const nuevosCandidatos = candidatosSeleccionados.map((c) => ({
      votacion_id: nuevaVotacion.id,
      nombre: c.nombre,
    }))

    const { error: errorCandidatos } = await supabase.from("candidatos").insert(nuevosCandidatos)

    if (errorCandidatos) {
      alert(errorCandidatos.message)
    }
  }

  const cerrarEleccionLideres = async () => {
    if (!votacionId) return

    const conteoOrdenado = [...conteoCandidatos].sort((a, b) => b.votos - a.votos)
    const total = votosEmitidos
    const necesarios = calcularNecesarios(total, "mayoria_simple")
    const primero = conteoOrdenado[0]

    if (!primero || total === 0) {
      await supabase
        .from("votaciones")
        .update({ estado: "cerrada", resultado: "sin_votos" })
        .eq("id", votacionId)

      await cargarVotacionActiva()
      await cargarResultadosCerrados()
      return
    }

    if (primero.votos >= necesarios) {
      await supabase
        .from("votaciones")
        .update({
          estado: "cerrada",
          resultado: "ganador",
          ganador_id: primero.id,
        })
        .eq("id", votacionId)

      alert(`Ganador oficial: ${primero.nombre}`)
      await cargarVotacionActiva()
      await cargarResultadosCerrados()
      return
    }

    await supabase.from("votaciones").update({ estado: "cerrada" }).eq("id", votacionId)

    if (ronda === 1) {
      if (conteoOrdenado.length > 3) {
        const top3 = conteoOrdenado.slice(0, 3)
        await supabase.from("votaciones").update({ resultado: "segunda_ronda" }).eq("id", votacionId)
        await crearSiguienteRonda(top3, 2)
        alert("Ningún candidato obtuvo mayoría simple. Se creó segunda ronda con los tres candidatos más votados.")
      } else {
        const top2 = conteoOrdenado.slice(0, 2)
        await supabase.from("votaciones").update({ resultado: "tercera_ronda" }).eq("id", votacionId)
        await crearSiguienteRonda(top2, 3)
        alert("Ningún candidato obtuvo mayoría simple. Se creó una nueva ronda con los dos candidatos más votados.")
      }
    } else if (ronda === 2) {
      const top2 = conteoOrdenado.slice(0, 2)
      await supabase.from("votaciones").update({ resultado: "tercera_ronda" }).eq("id", votacionId)
      await crearSiguienteRonda(top2, 3)
      alert("Ningún candidato obtuvo mayoría simple. Se creó tercera ronda con los dos candidatos más votados.")
    } else if (ronda === 3) {
      const top2 = conteoOrdenado.slice(0, 2)
      const hayEmpate = top2.length === 2 && top2[0].votos === top2[1].votos

      if (hayEmpate) {
        await supabase.from("votaciones").update({ resultado: "cuarta_ronda_empate" }).eq("id", votacionId)
        await crearSiguienteRonda(top2, 4)
        alert("Hubo empate. Se creó cuarta ronda.")
      } else {
        await supabase.from("votaciones").update({ resultado: "sin_mayoria" }).eq("id", votacionId)
        alert("No hubo mayoría. La votación quedó cerrada sin ganador.")
      }
    } else {
      await supabase.from("votaciones").update({ resultado: "empate_persistente" }).eq("id", votacionId)
      alert("La cuarta ronda cerró sin mayoría clara. Se requiere decisión parlamentaria.")
    }

    await cargarVotacionActiva()
    await cargarResultadosCerrados()
  }

  const cerrarVotacion = async () => {
    if (!votacionId) return

    if (tipoVotacion === "eleccion_lideres") {
      await cerrarEleccionLideres()
      return
    }

    const { error } = await supabase.from("votaciones").update({ estado: "cerrada" }).eq("id", votacionId)

    if (error) {
      alert(error.message)
      return
    }

    await cargarVotacionActiva()
    await cargarResultadosCerrados()
  }

  const simularVoto = async () => {
    if (estado !== "abierta" || !votacionId) return

    if (tipoVotacion === "eleccion_lideres") {
      alert("Para elecciones usa los botones de cada candidato.")
      return
    }

    const deviceId = getDeviceId()

    const res = await enviarVoto({
      token: TOKEN_PRUEBA,
      votacionId,
      opcion: "favor",
      candidatoId: null,
      deviceId,
    })

    if (!res.ok) {
  if (res.code === "YA_VOTO") {
    alert("Ya usted ha emitido su voto.")
  } else {
    alert(res.code)
  }
  return
}

    alert("Voto registrado correctamente.")
  }

  const votarPorCandidato = async (candidatoId: string) => {
    if (estado !== "abierta" || !votacionId) return

    const deviceId = getDeviceId()

    const res = await enviarVoto({
      token: TOKEN_PRUEBA,
      votacionId,
      opcion: null,
      candidatoId,
      deviceId,
    })

    if (!res.ok) {
      alert(res.code)
      return
    }

    alert("Voto registrado correctamente.")
  }

  const generarPDFAsamblea = async () => {
    if (!asambleaId) return

    const doc = new jsPDF()

    const { data: votaciones } = await supabase
      .from("votaciones")
      .select("*")
      .eq("asamblea_id", asambleaId)
      .eq("estado", "cerrada")

    const filas: any[] = []

    for (const votacion of votaciones || []) {
      const { data: votos } = await supabase
        .from("votos")
        .select("*")
        .eq("votacion_id", votacion.id)

      const total = votos?.length || 0
      const favor = votos?.filter((v) => v.opcion === "favor").length || 0
      const contra = votos?.filter((v) => v.opcion === "contra").length || 0

      const necesarios =
        votacion.tipo_mayoria === "dos_tercios"
          ? Math.ceil((2 / 3) * total)
          : Math.floor(total / 2) + 1

      let resultado = "No aprobado"

      if (votacion.tipo_votacion === "eleccion_lideres") {
        if (votacion.ganador_id) {
          const { data: ganador } = await supabase
            .from("candidatos")
            .select("*")
            .eq("id", votacion.ganador_id)
            .maybeSingle()

          resultado = ganador?.nombre || "Ganador"
        } else {
          resultado = votacion.resultado || "Sin resultado"
        }
      } else {
        resultado = favor >= necesarios ? "Aprobado" : "No aprobado"
      }

      filas.push([
        votacion.titulo,
        votacion.tipo_votacion,
        votacion.tipo_mayoria,
        total,
        favor,
        contra,
        necesarios,
        resultado,
      ])
    }

    doc.setFontSize(16)
    doc.text("Informe de Resultados de Asamblea", 14, 15)

    doc.setFontSize(11)
    doc.text(`Año: ${anioAsamblea}`, 14, 25)
    doc.text(`Lugar: ${lugarAsamblea}`, 14, 32)
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 39)

    autoTable(doc, {
      startY: 45,
      head: [[
        "Votación",
        "Tipo",
        "Mayoría",
        "Emitidos",
        "A favor",
        "En contra",
        "Necesarios",
        "Resultado",
      ]],
      body: filas,
    })

    const finalY = (doc as any).lastAutoTable.finalY || 60

    doc.text("Firmas oficiales", 14, finalY + 20)

    doc.line(14, finalY + 35, 90, finalY + 35)
    doc.text("Comité de Voto Electrónico", 14, finalY + 42)

    doc.line(110, finalY + 35, 190, finalY + 35)
    doc.text("Presidente Regional", 110, finalY + 42)

    doc.save(`Asamblea_${anioAsamblea}.pdf`)
  }

  const cerrarAsamblea = async () => {
    if (!asambleaId) return

    await supabase.from("votaciones").update({ estado: "cerrada" }).eq("asamblea_id", asambleaId)
    await generarPDFAsamblea()

    const { error } = await supabase
      .from("asambleas")
      .update({ estado: "cerrada" })
      .eq("id", asambleaId)

    if (error) {
      alert(error.message)
      return
    }

    setAsambleaId(null)
    setAnioAsamblea("")
    setLugarAsamblea("")
    setEstado("cerrada")
    setVotacionId(null)
    setTitulo("")
    setTipoMayoria("")
    setTipoVotacion("resolucion")
    setRonda(1)
    setCandidatos([])
    setConteoCandidatos([])
    setVotosEmitidos(0)
    setVotosAFavor(0)
    setVotosEnContra(0)
    setResultadosCerrados([])
  }

  useEffect(() => {
    cargarAsambleaActiva()
  }, [])

  useEffect(() => {
    if (asambleaId) {
      cargarVotacionActiva()
      cargarResultadosCerrados()
    }
  }, [asambleaId])

  useEffect(() => {
    if (votacionId) {
      cargarVotos(votacionId)
      cargarCandidatos(votacionId)
      cargarConteoCandidatos(votacionId)
    }
  }, [votacionId])

  useEffect(() => {
    if (!votacionId) return

    const channel = supabase
      .channel("realtime-votos")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votos",
        },
        () => {
          cargarVotos(votacionId)
          cargarConteoCandidatos(votacionId)
          cargarResultadosCerrados()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [votacionId, asambleaId])

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Panel del Moderador</h1>
          <p className="text-slate-600">Sistema de Asamblea y Votación Electrónica</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Abrir trabajos de asamblea</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input placeholder="Año de la asamblea" value={nuevoAnio} onChange={(e) => setNuevoAnio(e.target.value)} disabled={!!asambleaId} />
            <Input placeholder="Lugar de la asamblea" value={nuevoLugar} onChange={(e) => setNuevoLugar(e.target.value)} disabled={!!asambleaId} />
            <Button onClick={abrirAsamblea} disabled={!!asambleaId}>Abrir asamblea</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asamblea activa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {asambleaId ? (
              <>
                <p>Año: <span className="font-bold">{anioAsamblea}</span></p>
                <p>Lugar: <span className="font-bold">{lugarAsamblea}</span></p>
                <p className="font-bold text-green-600">Trabajos abiertos</p>
                <Button variant="destructive" onClick={cerrarAsamblea}>Cerrar trabajos de asamblea</Button>
              </>
            ) : (
              <p className="font-bold text-red-600">No hay asamblea activa</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Crear nueva votación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Input placeholder="Título de la votación" value={nuevoTitulo} onChange={(e) => setNuevoTitulo(e.target.value)} disabled={!asambleaId} />

              <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50" value={nuevoTipoVotacion} onChange={(e) => setNuevoTipoVotacion(e.target.value)} disabled={!asambleaId}>
                <option value="resolucion">Resolución</option>
                <option value="eleccion_lideres">Elección de Líderes Regionales</option>
              </select>

              <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50" value={nuevoTipoMayoria} onChange={(e) => setNuevoTipoMayoria(e.target.value)} disabled={!asambleaId || nuevoTipoVotacion === "eleccion_lideres"}>
                <option value="mayoria_simple">Mayoría simple</option>
                <option value="dos_tercios">Dos terceras partes</option>
              </select>

              <Button onClick={crearVotacion} disabled={!asambleaId}>Crear y abrir</Button>
            </div>

            {nuevoTipoVotacion === "eleccion_lideres" && (
              <div className="rounded-lg border bg-white p-4 space-y-3">
                <p className="font-semibold">Candidatos</p>
                {candidatosInput.map((candidato, index) => (
                  <div key={index} className="flex gap-2">
                    <Input placeholder={`Candidato ${index + 1}`} value={candidato} onChange={(e) => actualizarCandidatoInput(index, e.target.value)} />
                    <Button type="button" variant="destructive" onClick={() => eliminarCampoCandidato(index)}>Eliminar</Button>
                  </div>
                ))}
                <Button type="button" onClick={agregarCampoCandidato}>Añadir candidato</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Votación activa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-semibold">{titulo || "Sin votación activa"}</p>
            <p>Tipo de votación: {mostrarTipoVotacion(tipoVotacion)}</p>
            <p>Mayoría requerida: {tipoMayoria ? mostrarTipoMayoria(tipoMayoria) : "N/A"}</p>

            {tipoVotacion === "eleccion_lideres" && <p className="text-xl font-bold">Ronda #{ronda}</p>}

            <p>
              Estado:{" "}
              <span className={estado === "abierta" ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                {estado}
              </span>
            </p>

            {tipoVotacion === "eleccion_lideres" && candidatos.length > 0 && (
              <div className="pt-3 space-y-3">
                <p className="font-semibold">Votación por candidatos:</p>
                {candidatos.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                    <span className="font-medium">{c.nombre}</span>
                    <Button onClick={() => votarPorCandidato(c.id)} disabled={estado !== "abierta" || yaVoto}>Votar</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={simularVoto} disabled={estado !== "abierta" || yaVoto}>+1 voto resolución</Button>
            <Button variant="destructive" onClick={cerrarVotacion} disabled={estado !== "abierta"}>Cerrar votación</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultados en vivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tipoVotacion === "eleccion_lideres" ? (
              <>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <div><p>Votos emitidos</p><p className="text-2xl font-bold">{votosEmitidos}</p></div>
                  <div><p>Votos necesarios</p><p className="text-2xl font-bold">{votosNecesarios}</p></div>
                  <div>
                    <p>Resultado provisional</p>
                    <p className={`text-xl font-bold ${ganadorTieneMayoria ? "text-green-600" : "text-red-600"}`}>
                      {ganadorTieneMayoria ? `Ganando: ${ganadorActual?.nombre}` : "Sin mayoría todavía"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {rankingCandidatos.map((c, index) => (
                    <div key={c.id} className={`flex items-center justify-between rounded-lg border p-3 ${claseRanking(index)}`}>
                      <span className="font-medium">#{index + 1} {c.nombre}</span>
                      <span className="text-xl font-bold">{c.votos}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <div><p>Emitidos</p><p className="text-2xl font-bold">{votosEmitidos}</p></div>
                <div><p>A favor</p><p className="text-2xl font-bold text-green-600">{votosAFavor}</p></div>
                <div><p>En contra</p><p className="text-2xl font-bold text-red-600">{votosEnContra}</p></div>
                <div><p>Necesarios</p><p className="text-2xl font-bold">{votosNecesarios}</p></div>
                <div>
                  <p>Resultado</p>
                  <p className={`text-xl font-bold ${aprobado ? "text-green-600" : "text-red-600"}`}>
                    {aprobado ? "Aprobado" : "No aprobado"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultados de votaciones cerradas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {resultadosCerrados.length === 0 ? (
              <p className="text-slate-600">No hay votaciones cerradas todavía.</p>
            ) : (
              resultadosCerrados.map((r) => (
                <div key={r.id} className="rounded-lg border bg-white p-4 space-y-2">
                  <p className="font-semibold">{r.titulo}</p>
                  <p>Tipo de votación: {mostrarTipoVotacion(r.tipo_votacion)}</p>
                  <p>Mayoría: {mostrarTipoMayoria(r.tipo_mayoria)}</p>

                  {r.tipo_votacion === "eleccion_lideres" ? (
                    <p className="font-bold text-green-600">
                      {r.ganadorNombre ? `Ganador oficial: ${r.ganadorNombre}` : `Resultado: ${r.resultado || "procesado"}`}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                      <p>Emitidos: {r.votosEmitidos}</p>
                      <p>A favor: {r.votosAFavor}</p>
                      <p>En contra: {r.votosEnContra}</p>
                      <p>Necesarios: {r.votosNecesarios}</p>
                      <p className={r.aprobado ? "font-bold text-green-600" : "font-bold text-red-600"}>
                        {r.aprobado ? "Aprobado" : "No aprobado"}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}