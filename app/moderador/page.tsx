"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAsamblea } from "@/hooks/useAsamblea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCrearVotacion } from "@/hooks/useCrearVotacion"
import { useVotacion } from "@/hooks/useVotacion"
import { supabase } from "@/lib/supabaseClient"
import {
  calcularNecesarios,
  mostrarEstadoParlamentario,
  mostrarTipoMocion,
} from "@/lib/votacionHelpers"
import type { Mocion } from "@/lib/types"

export default function Moderador() {
  const {
    asambleaId,
    anioAsamblea,
    lugarAsamblea,
    nuevoAnio,
    nuevoLugar,
    setNuevoAnio,
    setNuevoLugar,
    abrirAsamblea,
    cerrarAsamblea,
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
  const porcentajeAprobacion =
    totalValidos > 0 ? Math.round((votosAFavor / totalValidos) * 100) : 0
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
      <div className="mx-auto max-w-6xl space-y-6">
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

        {!asambleaId && (
          <Card className="rounded-lg border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Abrir Asamblea</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
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
                    En curso
                  </p>
                  <p className="mt-1 text-xl font-black">Asamblea {anioAsamblea}</p>
                  <p className="text-slate-600">{lugarAsamblea}</p>
                </div>
                <div>
                  <Button onClick={cerrarAsambleaYActualizar} className="bg-[#16382f] hover:bg-[#0f2b24]">
                    Cerrar asamblea
                  </Button>
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

            <Button onClick={crearVotacionYActualizar} disabled={procesandoCreacion} className="bg-[#16382f] hover:bg-[#0f2b24]">
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

        <Card className="rounded-lg border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Resultados del moderador</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="font-semibold">{titulo || "No hay votación activa"}</p>
            <p>Tipo: {tipoVotacion}</p>
            <p>Votos emitidos: {votosEmitidos}</p>

            {tipoVotacion === "resolucion" && (
              <>
                <p>Moción: {mostrarTipoMocion(tipoMocion)}</p>
                {mocionPadreActual && (
                  <p>
                    Enmienda a: {mocionPadreActual.titulo}
                  </p>
                )}
                <p>
                  A favor: {votosAFavor} — En contra: {votosEnContra}
                </p>
                <p>Porcentaje a favor: {porcentajeAprobacion}%</p>
                <p>Votos necesarios: {votosNecesariosResolucion}</p>
              </>
            )}

            {tipoVotacion === "eleccion_lideres" && (
              <div className="space-y-3 rounded-lg border bg-slate-50 p-4">
                <p className="font-semibold">Ronda {rondaNumero}</p>
                <p>Votos necesarios para elección: {votosNecesariosLider}</p>

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

            <div className="flex gap-2">
              <Button onClick={cerrarVotacion}>Cerrar votación</Button>
              <Button onClick={publicarResultados}>Publicar resultados</Button>
              {requiereNuevaRonda && (
                <Button onClick={crearSiguienteRonda}>Crear siguiente ronda</Button>
              )}
            </div>

            {tipoVotacion === "eleccion_lideres" &&
              candidatosOrdenados.map((c, index) => (
                  <div key={c.id} className="border rounded p-3">
                    <p className="font-semibold">
                      #{index + 1} {c.nombre}
                    </p>
                    <p>Votos: {c.votos}</p>
                    <p>Porciento: {c.porcentaje}%</p>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
