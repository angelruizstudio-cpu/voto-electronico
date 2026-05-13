"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAsamblea } from "@/hooks/useAsamblea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCrearVotacion } from "@/hooks/useCrearVotacion"
import { useVotacion } from "@/hooks/useVotacion"
import {
  ResultadoOficialActualizado,
  VotosManualesPanel,
  type ResultadoManualActualizado,
} from "@/components/VotosManualesPanel"
import { supabase } from "@/lib/supabaseClient"
import {
  calcularNecesarios,
  mostrarEstadoParlamentario,
  mostrarTipoMayoria,
  mostrarTipoMocion,
} from "@/lib/votacionHelpers"
import type { Mocion } from "@/lib/types"

export default function Moderador() {
  const {
    asambleaId,
    anioAsamblea,
    lugarAsamblea,
    organizacionAsamblea,
    estadoAsamblea,
    nuevoAnio,
    nuevoLugar,
    nuevaOrganizacion,
    setNuevoAnio,
    setNuevoLugar,
    setNuevaOrganizacion,
    abrirAsamblea,
    cerrarAsamblea,
    ponerAsambleaEnReceso,
    reanudarAsamblea,
  } = useAsamblea()

  const {
    estado,
    votacionId,
    titulo,
    tipoMayoria,
    tipoVotacion,
    tipoMocion,
    mocionPadreId,
    rondaNumero,
    eleccionGrupoId,
    conteoCandidatos,
    votosEmitidos,
    votosAFavor,
    votosEnContra,
    votosAbstencion,
    cargarVotacionActiva,
  } = useVotacion(asambleaId)

  const {
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
    setNuevaResolucionRaizId,
    candidatosInput,
    setCandidatosInput,
    crearVotacion,
  } = useCrearVotacion(asambleaId, cargarVotacionActiva)
  const [ganadorSorteoId, setGanadorSorteoId] = useState("")
  const [mociones, setMociones] = useState<Mocion[]>([])
  const [procesandoCreacion, setProcesandoCreacion] = useState(false)
  const [enmiendaEnPreparacion, setEnmiendaEnPreparacion] = useState<Mocion | null>(null)
  const [resultadoManualActualizado, setResultadoManualActualizado] =
    useState<ResultadoManualActualizado | null>(null)
  const formularioVotacionRef = useRef<HTMLDivElement | null>(null)

  const cargarMociones = useCallback(async () => {
    if (!asambleaId) {
      setMociones([])
      return
    }

    const { data, error } = await supabase
      .from("votaciones")
      .select(
        "id, titulo, tipo_mocion, mocion_padre_id, resolucion_raiz_id, estado, estado_parlamentario, resultado"
      )
      .eq("asamblea_id", asambleaId)
      .eq("tipo_votacion", "resolucion")
      .order("creada_en", { ascending: true })

    if (error) {
      alert(error.message)
      return
    }

    setMociones((data || []) as Mocion[])
  }, [asambleaId])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarMociones()
    })
  }, [cargarMociones])

  const totalValidos = votosAFavor + votosEnContra
  const totalResolucion = votosAFavor + votosEnContra + votosAbstencion
  const porcentajeAprobacion =
    totalValidos > 0 ? Math.round((votosAFavor / totalValidos) * 100) : 0
  const porcentajeFavorResolucion =
    totalResolucion > 0 ? Math.round((votosAFavor / totalResolucion) * 100) : 0
  const porcentajeContraResolucion =
    totalResolucion > 0 ? Math.round((votosEnContra / totalResolucion) * 100) : 0
  const porcentajeAbstencionResolucion =
    totalResolucion > 0 ? Math.round((votosAbstencion / totalResolucion) * 100) : 0
  const votosNecesariosResolucion = calcularNecesarios(totalValidos, tipoMayoria)
  const mocionPadreActual = mociones.find((m) => m.id === mocionPadreId)
  const mocionesPadreDisponibles = mociones.filter((m) =>
    m.estado_parlamentario === "secundada" &&
    (nuevoTipoMocion === "enmienda"
      ? m.tipo_mocion === "resolucion_principal"
      : m.tipo_mocion === "enmienda")
  )
  const candidatosOrdenados = conteoCandidatos
    .slice()
    .sort((a, b) => b.votos - a.votos)
  const candidatosVistaPrevia = candidatosInput
    .map((nombre, index) => ({
      id: `preview-${index}`,
      nombre: nombre.trim() || `Candidato ${index + 1}`,
      votos: 0,
      porcentaje: 0,
    }))
    .filter((c) => c.nombre.trim().length > 0)
  const tipoPanelResultados = votacionId ? tipoVotacion : nuevoTipoVotacion
  const tipoMayoriaPanelResultados = votacionId ? tipoMayoria : nuevoTipoMayoria
  const tituloPanelResultados = votacionId
    ? titulo || "Votación activa"
    : nuevoTipoVotacion === "eleccion_lideres"
    ? nuevoTitulo || "Elección de líderes en preparación"
    : nuevoTitulo || "No hay votación activa"
  const candidatosParaGrafica =
    tipoPanelResultados === "eleccion_lideres" && votacionId
      ? candidatosOrdenados
      : candidatosVistaPrevia
  const votosNecesariosLider = calcularNecesarios(votosEmitidos, "mayoria_simple")
  const candidatoElecto =
    votosEmitidos > 0
      ? candidatosOrdenados.find((c) => c.votos >= votosNecesariosLider)
      : undefined
  const empateSorteo =
    tipoVotacion === "eleccion_lideres" &&
    rondaNumero >= 3 &&
    candidatosOrdenados.length === 2 &&
    votosEmitidos > 0 &&
    candidatosOrdenados[0]?.votos === candidatosOrdenados[1]?.votos
  const requiereNuevaRonda =
    tipoVotacion === "eleccion_lideres" &&
    votosEmitidos > 0 &&
    !candidatoElecto &&
    !empateSorteo &&
    rondaNumero < 3
  const cantidadSiguienteRonda = rondaNumero === 1 ? 3 : 2
  const candidatosSiguienteRonda = candidatosOrdenados.slice(0, cantidadSiguienteRonda)

  const mocionEstaFinalizada = (mocion: Mocion) =>
    mocion.estado_parlamentario === "aprobada" ||
    mocion.estado_parlamentario === "rechazada" ||
    Boolean(mocion.resultado)

  const buscarMocionHijaActiva = (mocion: Mocion) =>
    mociones.find(
      (posibleHija) =>
        posibleHija.mocion_padre_id === mocion.id &&
        !mocionEstaFinalizada(posibleHija)
    )

  const contarAsambleistasVotoManual = async () => {
    if (!asambleaId) return 0

    const { count, error } = await supabase
      .from("asambleistas")
      .select("*", { count: "exact", head: true })
      .eq("asamblea_id", asambleaId)
      .eq("metodo_voto", "manual")

    if (error) {
      alert(error.message)
      return null
    }

    return count || 0
  }

  const crearResultadoFinalElectronico = (
    resultado: string | null
  ): ResultadoManualActualizado | null => {
    if (!votacionId) return null

    if (tipoVotacion === "eleccion_lideres") {
      return {
        tipo: "eleccion_lideres",
        titulo: titulo || "Votación cerrada",
        emitidos: votosEmitidos,
        electronicos: votosEmitidos,
        manuales: 0,
        necesarios: votosNecesariosLider,
        resultado: resultado || "sin_eleccion",
        ganadorId: candidatoElecto?.id || null,
        ganadorNombre: candidatoElecto?.nombre || null,
        candidatos: candidatosOrdenados.map((candidato) => ({
          id: candidato.id,
          nombre: candidato.nombre,
          electronicos: candidato.votos,
          manuales: 0,
          votos: candidato.votos,
          porcentaje: candidato.porcentaje,
        })),
      }
    }

    return {
      tipo: "resolucion",
      titulo: titulo || "Votación cerrada",
      emitidos: votosEmitidos,
      electronicos: votosEmitidos,
      manuales: 0,
      favor: votosAFavor,
      contra: votosEnContra,
      abstencion: votosAbstencion,
      favorElectronico: votosAFavor,
      contraElectronico: votosEnContra,
      abstencionElectronica: votosAbstencion,
      favorManual: 0,
      contraManual: 0,
      abstencionManual: 0,
      validos: totalValidos,
      necesarios: votosNecesariosResolucion,
      resultado: resultado === "aprobada" ? "aprobada" : "rechazada",
    }
  }

  const describirSiguientePaso = (mocion: Mocion) => {
    if (mocion.resultado === "rechazada_sin_segundo") {
      return "No fue secundada. Se entiende rechazada por la asamblea."
    }

    if (mocion.tipo_mocion === "enmienda_a_enmienda") {
      if (mocion.resultado === "aprobada") {
        return "Presenta la enmienda revisada y ábrela a votación."
      }

      if (mocion.resultado === "rechazada") {
        return "Regresa a la enmienda principal y ábrela a votación."
      }
    }

    if (mocion.tipo_mocion === "enmienda") {
      if (mocion.resultado === "aprobada") {
        return "Presenta la resolución con las enmiendas y ábrela a votación."
      }

      if (mocion.resultado === "rechazada") {
        return "Regresa a la resolución principal y ábrela a votación."
      }
    }

    return ""
  }

  const cerrarVotacion = async () => {
    if (!votacionId) {
      alert("No hay votación activa")
      return
    }

    const cambiosCierre: Record<string, string | null> = { estado: "cerrada" }

    if (tipoVotacion === "eleccion_lideres") {
      cambiosCierre.resultado = candidatoElecto
        ? "electo"
        : empateSorteo
        ? "empate_sorteo"
        : requiereNuevaRonda
        ? "requiere_nueva_ronda"
        : "sin_eleccion"
      cambiosCierre.ganador_id = candidatoElecto?.id || null
    } else if (tipoVotacion === "resolucion") {
      const aprobada =
        totalValidos > 0 && votosAFavor >= votosNecesariosResolucion

      cambiosCierre.resultado = aprobada ? "aprobada" : "rechazada"
      cambiosCierre.estado_parlamentario = aprobada ? "aprobada" : "rechazada"
    }

    const { error } = await supabase
      .from("votaciones")
      .update(cambiosCierre)
      .eq("id", votacionId)

    if (error) {
      alert(error.message)
      return
    }

    const cantidadVotoManual = await contarAsambleistasVotoManual()

    if (cantidadVotoManual === 0) {
      setResultadoManualActualizado(
        crearResultadoFinalElectronico(cambiosCierre.resultado || null)
      )
    } else if (cantidadVotoManual && cantidadVotoManual > 0) {
      setResultadoManualActualizado(null)
    }

    alert("Votación cerrada")
    await cargarVotacionActiva()
    await cargarMociones()
  }

  const rechazarPorFaltaDeSegundo = async (mocionId: string) => {
    const { error } = await supabase
      .from("votaciones")
      .update({
        estado: "cerrada",
        estado_parlamentario: "rechazada",
        resultado: "rechazada_sin_segundo",
      })
      .eq("id", mocionId)

    if (error) {
      alert(error.message)
      return
    }

    await cargarMociones()
  }

  const secundarMocion = async (mocionId: string) => {
    const { error } = await supabase
      .from("votaciones")
      .update({ estado_parlamentario: "secundada" })
      .eq("id", mocionId)

    if (error) {
      alert(error.message)
      return
    }

    await cargarMociones()
  }

  const abrirVotacionMocion = async (mocionId: string) => {
    if (!asambleaId) return

    if (estadoAsamblea === "receso") {
      alert("La asamblea está en receso. Reanuda los trabajos antes de abrir una votación.")
      return
    }

    if (estado === "abierta" && votacionId && votacionId !== mocionId) {
      alert("Cierra la votación activa antes de abrir otra moción.")
      return
    }

    const { error } = await supabase
      .from("votaciones")
      .update({
        estado: "abierta",
        estado_parlamentario: "en_votacion",
      })
      .eq("id", mocionId)

    if (error) {
      alert(error.message)
      return
    }

    await cargarVotacionActiva()
    await cargarMociones()
  }

  const prepararEnmienda = (mocion: Mocion) => {
    const tipoNuevaMocion =
      mocion.tipo_mocion === "enmienda"
        ? "enmienda_a_enmienda"
        : "enmienda"

    setNuevoTitulo(
      tipoNuevaMocion === "enmienda"
        ? `Enmienda a: ${mocion.titulo}`
        : `Enmienda a la enmienda: ${mocion.titulo}`
    )
    setNuevoTipoVotacion("resolucion")
    setNuevoTipoMayoria("mayoria_simple")
    setNuevoTipoMocion(tipoNuevaMocion)
    setNuevaMocionPadreId(mocion.id)
    setNuevaResolucionRaizId(
      mocion.tipo_mocion === "resolucion_principal"
        ? mocion.id
        : mocion.resolucion_raiz_id || mocion.mocion_padre_id || mocion.id
    )
    setEnmiendaEnPreparacion(mocion)

    window.requestAnimationFrame(() => {
      formularioVotacionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }

  const crearSiguienteRonda = async () => {
    if (estadoAsamblea === "receso") {
      alert("La asamblea está en receso. Reanuda los trabajos antes de crear otra ronda.")
      return
    }

    if (!asambleaId || !votacionId || !requiereNuevaRonda) {
      alert("No hay una nueva ronda disponible")
      return
    }

    if (candidatosSiguienteRonda.length < cantidadSiguienteRonda) {
      alert("No hay suficientes candidatos para crear la siguiente ronda")
      return
    }

    const proximaRonda = rondaNumero + 1
    const tituloBase = titulo.replace(/\s+-\s+Ronda\s+\d+$/i, "")
    const grupoId = eleccionGrupoId || votacionId

    await supabase
      .from("votaciones")
      .update({ estado: "cerrada" })
      .eq("id", votacionId)

    const { data: nuevaVotacion, error: errorVotacion } = await supabase
      .from("votaciones")
      .insert({
        titulo: `${tituloBase} - Ronda ${proximaRonda}`,
        asamblea_id: asambleaId,
        estado: "abierta",
        tipo_mayoria: "mayoria_simple",
        tipo_votacion: "eleccion_lideres",
        publicada: false,
        ronda_numero: proximaRonda,
        eleccion_grupo_id: grupoId,
        votacion_anterior_id: votacionId,
      })
      .select()
      .single()

    if (errorVotacion || !nuevaVotacion) {
      alert(errorVotacion?.message || "No se pudo crear la siguiente ronda")
      return
    }

    const { error: errorCandidatos } = await supabase.from("candidatos").insert(
      candidatosSiguienteRonda.map((c) => ({
        votacion_id: nuevaVotacion.id,
        nombre: c.nombre,
      }))
    )

    if (errorCandidatos) {
      alert(errorCandidatos.message)
      return
    }

    alert(`Ronda ${proximaRonda} creada`)
    await cargarVotacionActiva()
  }

  const publicarResultados = async () => {
    if (!votacionId) {
      alert("No hay votación para publicar")
      return
    }

    const { error } = await supabase
      .from("votaciones")
      .update({ publicada: true })
      .eq("id", votacionId)

    if (error) {
      alert(error.message)
      return
    }

    alert("Resultados publicados")
    await cargarVotacionActiva()
  }

  const registrarGanadorSorteo = async () => {
    if (!votacionId || !empateSorteo) {
      alert("No hay empate final para resolver por sorteo")
      return
    }

    if (!ganadorSorteoId) {
      alert("Selecciona el nombre que salió del sorteo")
      return
    }

    const { error } = await supabase
      .from("votaciones")
      .update({
        estado: "cerrada",
        resultado: "electo_por_sorteo",
        ganador_id: ganadorSorteoId,
      })
      .eq("id", votacionId)

    if (error) {
      alert(error.message)
      return
    }

    alert("Ganador por sorteo registrado")
    setGanadorSorteoId("")
    await cargarVotacionActiva()
  }

  const crearVotacionYActualizar = async () => {
    if (estadoAsamblea === "receso") {
      alert("La asamblea está en receso. Reanuda los trabajos antes de crear una votación.")
      return
    }

    setProcesandoCreacion(true)
    const creada = await crearVotacion()
    setProcesandoCreacion(false)

    if (creada) {
      setEnmiendaEnPreparacion(null)
      await cargarMociones()
      await cargarVotacionActiva()
    }
  }

  const cerrarAsambleaYActualizar = async () => {
    const cerrada = await cerrarAsamblea()

    if (cerrada) {
      setMociones([])
      await cargarVotacionActiva()
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f1] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6f5b1d]">
            Panel del moderador
          </p>
          <div className="mt-2 flex items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-slate-950">
                Control de asamblea y votaciones
              </h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Apertura de asamblea, mociones parlamentarias, elecciones y publicación de resultados.
              </p>
            </div>
            <div className="rounded-lg bg-[#16382f] px-5 py-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7c27a]">
                Votación activa
              </p>
              <p className="mt-1 max-w-72 truncate text-lg font-black">
                {titulo || "Ninguna"}
              </p>
              <p className="mt-1 text-sm text-white/70">
                {votosEmitidos} votos emitidos
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(390px,0.78fr)] xl:items-start">
          <div className="space-y-6">
            {!asambleaId && (
              <Card className="rounded-lg border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Abrir Asamblea</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-[1.2fr_0.7fr_1fr_auto]">
              <input
                type="text"
                placeholder="Organización"
                value={nuevaOrganizacion}
                onChange={(e) => setNuevaOrganizacion(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
              />
              <input
                type="text"
                placeholder="Año"
                value={nuevoAnio}
                onChange={(e) => setNuevoAnio(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
              />
              <input
                type="text"
                placeholder="Lugar"
                value={nuevoLugar}
                onChange={(e) => setNuevoLugar(e.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
              />
                  <Button onClick={abrirAsamblea} className="h-11 bg-[#16382f] px-5 hover:bg-[#0f2b24]">
                    Abrir
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-lg border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Asamblea activa</CardTitle>
          </CardHeader>
          <CardContent>
            {asambleaId ? (
              <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                    {estadoAsamblea === "receso" ? "En receso" : "En curso"}
                  </p>
                  <p className="mt-1 text-xl font-black">
                    {organizacionAsamblea || "Organización no especificada"}
                  </p>
                  <p className="text-slate-600">
                    Asamblea {anioAsamblea} · {lugarAsamblea}
                  </p>
                </div>
                <div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {estadoAsamblea === "receso" ? (
                      <Button onClick={reanudarAsamblea} className="bg-emerald-700 hover:bg-emerald-800">
                        Reanudar trabajos
                      </Button>
                    ) : (
                      <Button onClick={ponerAsambleaEnReceso} className="bg-amber-600 hover:bg-amber-700">
                        Poner en receso
                      </Button>
                    )}
                    <Button onClick={cerrarAsambleaYActualizar} className="bg-[#16382f] hover:bg-[#0f2b24]">
                      Cerrar asamblea
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-amber-50 p-4 font-semibold text-amber-800">
                No hay asamblea activa
              </p>
            )}
          </CardContent>
            </Card>

            <Card ref={formularioVotacionRef} className="rounded-lg border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Crear votación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {votacionId && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                Hay una votación activa: {titulo}. Puedes preparar una moción, pero cierra la votación activa antes de abrir otra.
              </div>
            )}

            {estadoAsamblea === "receso" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                La asamblea está en receso. Puedes preparar información, pero no abrir votaciones hasta reanudar los trabajos.
              </div>
            )}

            {enmiendaEnPreparacion && (
              <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
                Preparando {nuevoTipoMocion === "enmienda" ? "enmienda" : "enmienda a la enmienda"} para:{" "}
                <span className="font-semibold">{enmiendaEnPreparacion.titulo}</span>
              </div>
            )}

            <input
              type="text"
              placeholder="Título"
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
            />

            <select
              value={nuevoTipoVotacion}
              onChange={(e) => setNuevoTipoVotacion(e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
            >
              <option value="resolucion">Resolución</option>
              <option value="eleccion_lideres">Elección de líderes</option>
            </select>

            {nuevoTipoVotacion === "resolucion" && (
              <div className="space-y-3">
                <select
                  value={nuevoTipoMayoria}
                  onChange={(e) => setNuevoTipoMayoria(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
                >
                  <option value="mayoria_simple">Mayoría simple</option>
                  <option value="dos_tercios">Dos tercios</option>
                </select>

                <select
                  value={nuevoTipoMocion}
                  onChange={(e) => {
                    setNuevoTipoMocion(e.target.value)
                    setNuevaMocionPadreId("")
                    setNuevaResolucionRaizId("")
                  }}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
                >
                  <option value="resolucion_principal">Resolución principal</option>
                  <option value="enmienda">Enmienda</option>
                  <option value="enmienda_a_enmienda">Enmienda a la enmienda</option>
                </select>

                {nuevoTipoMocion !== "resolucion_principal" && (
                  <select
                    value={nuevaMocionPadreId}
                    onChange={(e) => {
                      const parentId = e.target.value
                      const parent = mociones.find((m) => m.id === parentId)

                      setNuevaMocionPadreId(parentId)
                      setNuevaResolucionRaizId(
                        nuevoTipoMocion === "enmienda"
                          ? parentId
                          : parent?.resolucion_raiz_id || parent?.mocion_padre_id || parentId
                      )
                    }}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
                  >
                    <option value="">
                      {nuevoTipoMocion === "enmienda"
                        ? "Selecciona la resolución a enmendar"
                        : "Selecciona la enmienda a enmendar"}
                    </option>
                    {mocionesPadreDisponibles.map((m) => (
                      <option key={m.id} value={m.id}>
                        {mostrarTipoMocion(m.tipo_mocion)}: {m.titulo}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {nuevoTipoVotacion === "eleccion_lideres" && (
              <div className="space-y-2">
                {candidatosInput.map((c, index) => (
                  <input
                    key={index}
                    type="text"
                    placeholder={`Candidato ${index + 1}`}
                    value={c}
                    onChange={(e) => {
                      const nuevos = [...candidatosInput]
                      nuevos[index] = e.target.value
                      setCandidatosInput(nuevos)
                    }}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
                  />
                ))}

                <Button
                  type="button"
                  onClick={() => setCandidatosInput([...candidatosInput, ""])}
                >
                  + Añadir candidato
                </Button>
              </div>
            )}

            <Button
              onClick={crearVotacionYActualizar}
              disabled={procesandoCreacion || estadoAsamblea === "receso"}
              className="bg-[#16382f] hover:bg-[#0f2b24]"
            >
              {procesandoCreacion
                ? "Procesando..."
                : nuevoTipoVotacion === "resolucion"
                ? "Presentar moción"
                : "Crear y abrir"}
            </Button>
          </CardContent>
            </Card>

            <Card className="rounded-lg border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Flujo de resoluciones y enmiendas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mociones.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-4 text-slate-600">
                No hay resoluciones o enmiendas presentadas.
              </p>
            ) : (
              mociones.map((mocion) => {
                const siguientePaso = describirSiguientePaso(mocion)
                const finalizada = mocionEstaFinalizada(mocion)
                const mocionHijaActiva = buscarMocionHijaActiva(mocion)
                const botonesBloqueados = Boolean(mocionHijaActiva)

                return (
                  <div key={mocion.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                    <div>
                      <p className="font-black text-slate-950">{mocion.titulo}</p>
                      <p className="text-sm font-semibold text-slate-600">
                        {mostrarTipoMocion(mocion.tipo_mocion)} ·{" "}
                        {mostrarEstadoParlamentario(mocion.estado_parlamentario)}
                      </p>
                    </div>

                    {siguientePaso && (
                      <p className="rounded bg-yellow-50 p-2 text-sm font-semibold text-yellow-800">
                        {siguientePaso}
                      </p>
                    )}

                    {mocionHijaActiva && (
                      <p className="rounded bg-slate-100 p-2 text-sm font-semibold text-slate-700">
                        Botones deshabilitados hasta votar: {mocionHijaActiva.titulo}
                      </p>
                    )}

                    {!finalizada && (
                      <div className="flex flex-wrap gap-2">
                        {mocion.estado_parlamentario === "esperando_segundo" && (
                          <>
                        <Button
                              onClick={() => secundarMocion(mocion.id)}
                              disabled={botonesBloqueados}
                              className="bg-[#16382f] hover:bg-[#0f2b24]"
                            >
                              Marcar secundada
                            </Button>
                            <Button
                              onClick={() => rechazarPorFaltaDeSegundo(mocion.id)}
                              disabled={botonesBloqueados}
                            >
                              No fue secundada
                            </Button>
                          </>
                        )}

                        {mocion.estado_parlamentario === "secundada" && (
                          <>
                            <Button
                              onClick={() => abrirVotacionMocion(mocion.id)}
                              disabled={botonesBloqueados}
                            >
                              Debatir y votar
                            </Button>
                            {mocion.tipo_mocion !== "enmienda_a_enmienda" && (
                              <Button
                                onClick={() => prepararEnmienda(mocion)}
                                disabled={botonesBloqueados}
                              >
                                Presentar enmienda
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
            </Card>

            <VotosManualesPanel
              asambleaId={asambleaId}
              onResultadosActualizados={setResultadoManualActualizado}
            />
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6">
            <Card className="rounded-lg border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>
              {tipoPanelResultados === "eleccion_lideres"
                ? "Elección de líderes"
                : "Resultados del moderador"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="font-semibold">{tituloPanelResultados}</p>
            <p>
              Tipo:{" "}
              {tipoPanelResultados === "eleccion_lideres"
                ? "Elección de líderes"
                : "Resolución"}
            </p>
            <p>Votos emitidos: {votacionId ? votosEmitidos : 0}</p>

            {tipoPanelResultados === "resolucion" && (
              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Estado
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {votacionId
                        ? estado === "abierta"
                          ? "Abierta"
                          : "Cerrada"
                        : "En preparación"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Moción
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {mostrarTipoMocion(votacionId ? tipoMocion : nuevoTipoMocion)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Mayoría
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {mostrarTipoMayoria(tipoMayoriaPanelResultados)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Necesarios
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {votacionId ? votosNecesariosResolucion : 0}
                    </p>
                  </div>
                </div>

                {mocionPadreActual && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                    Enmienda a: {mocionPadreActual.titulo}
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-emerald-100 bg-white p-4">
                    <p className="text-sm font-bold text-emerald-700">A favor</p>
                    <p className="mt-1 text-3xl font-black text-emerald-800">
                      {votosAFavor}
                    </p>
                    <p className="text-sm text-slate-500">{porcentajeFavorResolucion}% del total</p>
                  </div>
                  <div className="rounded-lg border border-red-100 bg-white p-4">
                    <p className="text-sm font-bold text-red-700">En contra</p>
                    <p className="mt-1 text-3xl font-black text-red-800">
                      {votosEnContra}
                    </p>
                    <p className="text-sm text-slate-500">{porcentajeContraResolucion}% del total</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-sm font-bold text-slate-700">Abstención</p>
                    <p className="mt-1 text-3xl font-black text-slate-800">
                      {votosAbstencion}
                    </p>
                    <p className="text-sm text-slate-500">{porcentajeAbstencionResolucion}% del total</p>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm font-bold">
                      <span className="text-emerald-700">A favor</span>
                      <span>{porcentajeFavorResolucion}%</span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${porcentajeFavorResolucion}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm font-bold">
                      <span className="text-red-700">En contra</span>
                      <span>{porcentajeContraResolucion}%</span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-red-600 transition-all"
                        style={{ width: `${porcentajeContraResolucion}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm font-bold">
                      <span className="text-slate-700">Abstención</span>
                      <span>{porcentajeAbstencionResolucion}%</span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-500 transition-all"
                        style={{ width: `${porcentajeAbstencionResolucion}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className={[
                    "rounded-lg p-4 font-bold",
                    votacionId && totalValidos > 0 && votosAFavor >= votosNecesariosResolucion
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-50 text-amber-900",
                  ].join(" ")}
                >
                  {votacionId && totalValidos > 0
                    ? votosAFavor >= votosNecesariosResolucion
                      ? `La moción alcanza la mayoría requerida con ${porcentajeAprobacion}% de los votos válidos.`
                      : `La moción aún no alcanza la mayoría requerida. Lleva ${porcentajeAprobacion}% de los votos válidos.`
                    : "Cuando se abra la votación, aquí verás el progreso de la resolución en tiempo real."}
                </div>
              </div>
            )}

            {tipoPanelResultados === "eleccion_lideres" && (
              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Estado
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {votacionId
                        ? estado === "abierta"
                          ? "Abierta"
                          : "Cerrada"
                        : "En preparación"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Ronda
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {votacionId ? rondaNumero : 1}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Votos necesarios
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {votacionId && votosEmitidos > 0
                        ? votosNecesariosLider
                        : "Pendiente de votos"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {candidatosParaGrafica.length === 0 ? (
                    <p className="rounded-lg bg-white p-4 text-slate-600">
                      Añade candidatos para ver la gráfica de la elección.
                    </p>
                  ) : (
                    candidatosParaGrafica.map((c, index) => (
                      <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="font-black text-slate-950">
                            #{index + 1} {c.nombre}
                          </p>
                          <p className="shrink-0 text-sm font-black text-[#16382f]">
                            {c.porcentaje}% · {c.votos} votos
                          </p>
                        </div>
                        <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#16382f] transition-all"
                            style={{ width: `${Math.min(c.porcentaje, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {candidatoElecto && (
                  <p className="rounded bg-green-100 p-3 font-bold text-green-700">
                    Electo: {candidatoElecto.nombre} con {candidatoElecto.votos} votos
                  </p>
                )}

                {requiereNuevaRonda && (
                  <div className="space-y-2 rounded bg-yellow-100 p-3 text-yellow-900">
                    <p className="font-bold">No hubo elección. Se requiere nueva ronda.</p>
                    <p>
                      Pasan:{" "}
                      {candidatosSiguienteRonda.map((c) => c.nombre).join(", ")}
                    </p>
                  </div>
                )}

                {empateSorteo && (
                  <div className="space-y-3 rounded bg-red-100 p-3 text-red-700">
                    <p className="font-bold">Empate final. Resolver por sorteo físico.</p>
                    <select
                      value={ganadorSorteoId}
                      onChange={(e) => setGanadorSorteoId(e.target.value)}
                      className="w-full rounded border border-red-200 bg-white p-2 text-slate-900"
                    >
                      <option value="">Selecciona el nombre sorteado</option>
                      {candidatosOrdenados.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                    <Button onClick={registrarGanadorSorteo}>
                      Registrar ganador por sorteo
                    </Button>
                  </div>
                )}
              </div>
            )}

            {votacionId && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={cerrarVotacion}>Cerrar votación</Button>
                <Button onClick={publicarResultados}>Publicar resultados</Button>
                {requiereNuevaRonda && (
                  <Button onClick={crearSiguienteRonda}>Crear siguiente ronda</Button>
                )}
              </div>
            )}
          </CardContent>
            </Card>
            <ResultadoOficialActualizado resultado={resultadoManualActualizado} />
          </aside>
        </div>
      </div>
    </main>
  )
}
