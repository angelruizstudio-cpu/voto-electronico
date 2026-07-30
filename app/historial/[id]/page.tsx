"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { BarChart3, Download, RefreshCw, Trophy, Vote } from "lucide-react"
import {
  calcularVotosValidosCandidatos,
  mostrarEstadoParlamentario,
  mostrarTipoMayoria,
  mostrarTipoMocion,
  mostrarTipoVotacion,
} from "@/lib/votacionHelpers"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

type Asamblea = {
  id: string
  anio: number
  lugar: string
  estado: string
  organizacion_id?: string | null
  organizacion_slug?: string | null
}

type VotacionDetalle = {
  id: string
  titulo: string
  tipo_votacion: string
  tipo_mayoria: string
  tipo_mocion: string
  estado_parlamentario: string | null
  estado: string
  resultado?: string
  ganadorNombre?: string
  ronda_numero?: number
  eleccion_grupo_id?: string | null
  mocion_padre_id?: string | null
  resolucion_raiz_id?: string | null
  emitidos: number
  favor: number
  contra: number
  abstencion: number
  necesarios: number
  aprobado: boolean
  candidatos?: {
    nombre: string
    votos: number
  }[]
}

type PdfConAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY?: number
  }
}

type GrupoEleccion = {
  titulo: string
  rondas: VotacionDetalle[]
}

type FiltroResultados = "todos" | "elecciones" | "resoluciones"

const cargarLogoOficial = async () => {
  try {
    const res = await fetch("/logo_voto_electronico.png")
    if (!res.ok) return null

    const blob = await res.blob()

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export default function DetalleAsamblea({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [asamblea, setAsamblea] = useState<Asamblea | null>(null)
  const [votaciones, setVotaciones] = useState<VotacionDetalle[]>([])
  const [cargando, setCargando] = useState(true)
  const [actualizadoEn, setActualizadoEn] = useState<Date | null>(null)
  const [filtro, setFiltro] = useState<FiltroResultados>("todos")

  const mostrarResultado = (v: VotacionDetalle) => {
    if (v.resultado === "electo_por_sorteo") {
      return `Electo por sorteo físico${v.ganadorNombre ? `: ${v.ganadorNombre}` : ""}`
    }

    if (v.resultado === "electo") {
      return `Electo${v.ganadorNombre ? `: ${v.ganadorNombre}` : ""}`
    }

    if (v.resultado === "empate_sorteo") return "Empate final: sorteo físico pendiente"
    if (v.resultado === "requiere_nueva_ronda") return "Requiere nueva ronda"
    if (v.resultado === "rechazada_sin_segundo") return "Rechazada por falta de segundo"
    if (v.resultado === "aprobada") return "Aprobada"
    if (v.resultado === "rechazada") return "Rechazada"

    if (v.tipo_votacion === "resolucion") {
      return v.aprobado ? "Aprobada" : "No aprobada"
    }

    return v.ganadorNombre || "Procesado"
  }

  const claseResultado = (v: VotacionDetalle) => {
    if (v.resultado === "electo" || v.resultado === "electo_por_sorteo" || v.resultado === "aprobada") {
      return "border-emerald-200 bg-emerald-50 text-emerald-800"
    }

    if (v.resultado === "requiere_nueva_ronda" || v.resultado === "empate_sorteo") {
      return "border-amber-200 bg-amber-50 text-amber-800"
    }

    if (v.resultado === "rechazada" || v.resultado === "rechazada_sin_segundo" || !v.aprobado) {
      return "border-rose-200 bg-rose-50 text-rose-800"
    }

    return "border-slate-200 bg-slate-50 text-slate-700"
  }

  const porcentaje = (votos: number, total: number) => {
    if (!total) return 0
    return Math.round((votos / total) * 100)
  }

  const cargarDetalle = useCallback(async () => {
    setCargando(true)

    try {
      const res = await fetch(`/api/historial/${id}`, {
        cache: "no-store",
        credentials: "same-origin",
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo cargar el historial")
      }

      setAsamblea(data.asamblea)
      setVotaciones(data.votaciones || [])
      setActualizadoEn(new Date())
    } catch {
      setAsamblea(null)
      setVotaciones([])
    } finally {
      setCargando(false)
    }
  }, [id])

  const elecciones = votaciones.filter((v) => v.tipo_votacion === "eleccion_lideres")
  const resoluciones = votaciones.filter((v) => v.tipo_votacion === "resolucion")
  const votacionesFiltradas = useMemo(() => {
    if (filtro === "elecciones") return elecciones
    if (filtro === "resoluciones") return resoluciones
    return votaciones
  }, [elecciones, filtro, resoluciones, votaciones])
  const totalEmitidos = votaciones.reduce((total, votacion) => total + votacion.emitidos, 0)

  const descargarPDF = async () => {
    if (!asamblea) return

    const doc = new jsPDF()
    const logoOficial = await cargarLogoOficial()

    if (logoOficial) {
      doc.addImage(logoOficial, "PNG", 14, 9, 32, 18)
    }

    doc.setFontSize(16)
    doc.text("Informe Histórico de Asamblea", logoOficial ? 52 : 14, 15)

    doc.setFontSize(11)
    doc.text(`Año: ${asamblea.anio}`, logoOficial ? 52 : 14, 25)
    doc.text(`Lugar: ${asamblea.lugar}`, logoOficial ? 52 : 14, 32)
    doc.text(`Estado: ${asamblea.estado}`, 14, 42)
    doc.text("Documento: ARCHIVO HISTÓRICO", 14, 49)
    doc.text(`Total de asuntos registrados: ${votaciones.length}`, 14, 56)

    const filas = votaciones.map((v) => [
      v.titulo,
      v.tipo_votacion === "resolucion"
        ? mostrarTipoMocion(v.tipo_mocion)
        : `${mostrarTipoVotacion(v.tipo_votacion)}${v.ronda_numero ? ` - Ronda ${v.ronda_numero}` : ""}`,
      mostrarTipoMayoria(v.tipo_mayoria),
      v.emitidos,
      v.tipo_votacion === "eleccion_lideres" ? "-" : v.favor,
      v.tipo_votacion === "eleccion_lideres" ? "-" : v.contra,
      v.necesarios,
      mostrarResultado(v),
    ])

    autoTable(doc, {
      startY: 64,
      head: [[
        "Asunto",
        "Tipo",
        "Mayoría",
        "Emitidos",
        "A favor",
        "En contra",
        "Necesarios",
        "Resultado",
      ]],
      body: filas,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 45, 85] },
    })

    let cursorY = (doc as PdfConAutoTable).lastAutoTable?.finalY || 70

    const gruposElecciones = elecciones
      .reduce<GrupoEleccion[]>((grupos, votacion) => {
        const llave = votacion.eleccion_grupo_id || votacion.id
        const grupoExistente = grupos.find((grupo) =>
          grupo.rondas.some((ronda) => (ronda.eleccion_grupo_id || ronda.id) === llave)
        )

        if (grupoExistente) {
          grupoExistente.rondas.push(votacion)
          return grupos
        }

        grupos.push({ titulo: votacion.titulo, rondas: [votacion] })
        return grupos
      }, [])
      .map((grupo) => ({
        ...grupo,
        rondas: grupo.rondas.sort((a, b) => (a.ronda_numero || 1) - (b.ronda_numero || 1)),
      }))

    const dibujarActaEleccion = (grupo: GrupoEleccion, inicioY: number) => {
      const etiquetaRonda = (numero: number) => {
        if (numero === 1) return "1ra. Ronda"
        if (numero === 2) return "2da. Ronda"
        if (numero === 3) return "3ra. Ronda"
        return `${numero}ta. Ronda`
      }
      const margenX = 14
      const tablaAncho = 182
      const colAnchos = [34, 34, 23, 34, 34, 23]
      const altoTitulo = 7
      const altoEncabezado = 12
      const altoResultado = 8
      const altoRonda = 7
      const altoFila = 8
      const filasMinimas = 7
      const maxCandidatos = Math.max(
        filasMinimas,
        ...grupo.rondas.slice(0, 2).map((ronda) => ronda.candidatos?.length || 0)
      )
      const tablaAlto =
        altoTitulo + altoEncabezado + altoResultado + altoRonda + maxCandidatos * altoFila

      if (inicioY + tablaAlto > 270) {
        doc.addPage()
        inicioY = 18
      }

      const x = margenX
      const y = inicioY
      const grupoUnoX = x
      const grupoDosX = x + colAnchos[0] + colAnchos[1] + colAnchos[2]
      const grupoAncho = tablaAncho / 2
      const titulo = grupo.titulo.toUpperCase()

      doc.setDrawColor(70, 70, 70)
      doc.setLineWidth(0.25)
      doc.setFillColor(218, 218, 218)
      doc.rect(x, y, tablaAncho, altoTitulo, "FD")
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text(titulo, x + tablaAncho / 2, y + 5, { align: "center" })

      const headerY = y + altoTitulo
      doc.setFontSize(7.5)
      doc.setFont("helvetica", "bold")

      let cursorX = x
      colAnchos.forEach((ancho) => {
        doc.rect(cursorX, headerY, ancho, altoEncabezado)
        cursorX += ancho
      })

      const headers = [
        ["Votos", "Emitidos"],
        ["Votos", "Necesarios"],
        ["Elección", "Sí - No"],
        ["Votos", "Emitidos"],
        ["Votos", "Necesarios"],
        ["Elección", "Sí - No"],
      ]

      cursorX = x
      headers.forEach((lineas, index) => {
        const centro = cursorX + colAnchos[index] / 2
        doc.text(lineas[0], centro, headerY + 5, { align: "center" })
        doc.text(lineas[1], centro, headerY + 9, { align: "center" })
        cursorX += colAnchos[index]
      })

      const resultadoY = headerY + altoEncabezado
      cursorX = x
      colAnchos.forEach((ancho) => {
        doc.rect(cursorX, resultadoY, ancho, altoResultado)
        cursorX += ancho
      })

      grupo.rondas.slice(0, 2).forEach((ronda, index) => {
        const baseX = index === 0 ? grupoUnoX : grupoDosX
        const baseCol = index === 0 ? 0 : 3
        const resultadoEleccion = ronda.resultado === "electo" || ronda.resultado === "electo_por_sorteo"
          ? "Sí"
          : ronda.resultado
          ? "No"
          : "-"

        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text(String(ronda.emitidos), baseX + colAnchos[baseCol] / 2, resultadoY + 5.8, {
          align: "center",
        })
        doc.text(
          String(ronda.necesarios),
          baseX + colAnchos[baseCol] + colAnchos[baseCol + 1] / 2,
          resultadoY + 5.8,
          { align: "center" }
        )
        doc.text(
          resultadoEleccion,
          baseX + colAnchos[baseCol] + colAnchos[baseCol + 1] + colAnchos[baseCol + 2] / 2,
          resultadoY + 5.8,
          { align: "center" }
        )
      })

      const rondaY = resultadoY + altoResultado
      doc.setLineWidth(0.45)
      doc.line(x, rondaY, x + tablaAncho, rondaY)
      doc.setLineWidth(0.25)
      doc.rect(grupoUnoX, rondaY, grupoAncho, altoRonda)
      doc.rect(grupoDosX, rondaY, grupoAncho, altoRonda)
      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")
      doc.text(
        etiquetaRonda(grupo.rondas[0]?.ronda_numero || 1),
        grupoUnoX + grupoAncho / 2,
        rondaY + 4.8,
        { align: "center" }
      )
      doc.text(
        grupo.rondas[1] ? etiquetaRonda(grupo.rondas[1].ronda_numero || 2) : "",
        grupoDosX + grupoAncho / 2,
        rondaY + 4.8,
        { align: "center" }
      )

      const cuerpoY = rondaY + altoRonda
      for (let fila = 0; fila < maxCandidatos; fila += 1) {
        const filaY = cuerpoY + fila * altoFila
        cursorX = x
        colAnchos.forEach((ancho) => {
          doc.rect(cursorX, filaY, ancho, altoFila)
          cursorX += ancho
        })
      }

      grupo.rondas.slice(0, 2).forEach((ronda, index) => {
        const baseX = index === 0 ? grupoUnoX : grupoDosX
        const candidatoX = baseX + 3
        const votosX = baseX + colAnchos[index === 0 ? 0 : 3] + colAnchos[index === 0 ? 1 : 4] + colAnchos[index === 0 ? 2 : 5] / 2

        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        ;(ronda.candidatos || []).forEach((candidato, fila) => {
          const filaY = cuerpoY + fila * altoFila + 5.2
          doc.text(candidato.nombre, candidatoX, filaY, { maxWidth: grupoAncho - 28 })
          doc.setFont("helvetica", "bold")
          doc.text(String(candidato.votos), votosX, filaY, { align: "center" })
          doc.setFont("helvetica", "normal")
        })
      })

      return y + tablaAlto
    }

    if (gruposElecciones.length > 0) {
      doc.setFontSize(13)
      doc.setFont("helvetica", "bold")
      doc.text("Acta de elecciones", 14, cursorY + 12)
      cursorY += 18

      gruposElecciones.forEach((grupo) => {
        for (let index = 0; index < grupo.rondas.length; index += 2) {
          cursorY =
            dibujarActaEleccion(
              {
                titulo: grupo.titulo,
                rondas: grupo.rondas.slice(index, index + 2),
              },
              cursorY
            ) + 10
        }
      })
    }

    const firmasY = cursorY

    doc.text("Firmas oficiales", 14, firmasY + 20)

    doc.line(14, firmasY + 35, 90, firmasY + 35)
    doc.text("Presidente Comité de Escrutinio", 14, firmasY + 42)

    doc.line(110, firmasY + 35, 190, firmasY + 35)
    doc.text("Presidente", 110, firmasY + 42)

    doc.save(`Asamblea_${asamblea.anio}_${asamblea.lugar}.pdf`)
  }

  useEffect(() => {
    queueMicrotask(() => {
      void cargarDetalle()
    })
  }, [cargarDetalle])

  return (
    <div className="min-h-screen bg-[#f4f6f1] px-4 py-6 text-slate-950 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border border-[#d9dfd6] bg-white shadow-sm">
          <div className="flex flex-col gap-5 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#b58b18]">
                Archivo histórico
              </p>
              <h1 className="mt-1 text-3xl font-black text-[#123c32]">Detalle de Asamblea</h1>
              <p className="mt-1 text-sm text-slate-600">
                {asamblea
                  ? `${asamblea.anio} - ${asamblea.lugar}`
                  : cargando
                    ? "Cargando informacion de la asamblea..."
                    : "Asamblea no encontrada"}
              </p>
              {actualizadoEn && (
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Actualizado {actualizadoEn.toLocaleTimeString("es-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void cargarDetalle()}
                disabled={cargando}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${cargando ? "animate-spin" : ""}`} />
                Recargar
              </Button>
              <Button onClick={descargarPDF} disabled={!asamblea || cargando}>
                <Download className="mr-2 h-4 w-4" />
                Descargar PDF
              </Button>
            </div>
          </div>

          <div className="grid gap-3 p-5 md:grid-cols-4">
            <div className="rounded-lg bg-[#f8faf8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Asuntos
              </p>
              <p className="mt-2 text-3xl font-black text-[#123c32]">{votaciones.length}</p>
            </div>
            <div className="rounded-lg bg-[#f8faf8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Elecciones
              </p>
              <p className="mt-2 text-3xl font-black text-[#123c32]">{elecciones.length}</p>
            </div>
            <div className="rounded-lg bg-[#f8faf8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Resoluciones
              </p>
              <p className="mt-2 text-3xl font-black text-[#123c32]">{resoluciones.length}</p>
            </div>
            <div className="rounded-lg bg-[#f8faf8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Votos emitidos
              </p>
              <p className="mt-2 text-3xl font-black text-[#123c32]">{totalEmitidos}</p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          {[
            { id: "todos", label: "Todos", total: votaciones.length },
            { id: "elecciones", label: "Elecciones", total: elecciones.length },
            { id: "resoluciones", label: "Resoluciones", total: resoluciones.length },
          ].map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              onClick={() => setFiltro(opcion.id as FiltroResultados)}
              className={`rounded-md px-4 py-2 text-sm font-black transition ${
                filtro === opcion.id
                  ? "bg-[#123c32] text-white shadow-sm"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {opcion.label} <span className="ml-1 opacity-75">({opcion.total})</span>
            </button>
          ))}
        </div>

        {cargando ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
            <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
            <div className="mt-5 grid gap-3">
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
            </div>
          </div>
        ) : votacionesFiltradas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <Vote className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-lg font-black">No hay votaciones en esta vista.</p>
            <p className="mt-1 text-sm text-slate-500">
              Usa Recargar si acabas de cerrar una votacion.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {votacionesFiltradas.map((v) => {
              const totalCandidatos = calcularVotosValidosCandidatos(v.candidatos || [])
              const esEleccion = v.tipo_votacion === "eleccion_lideres"

              return (
                <details
                  key={v.id}
                  open
                  className="group rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-[#e9f3ef] p-2 text-[#123c32]">
                        {esEleccion ? <Trophy className="h-5 w-5" /> : <BarChart3 className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="text-lg font-black text-[#123c32]">{v.titulo}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {esEleccion
                            ? `Ronda ${v.ronda_numero || 1} - ${mostrarTipoMayoria(v.tipo_mayoria)}`
                            : `${mostrarTipoMocion(v.tipo_mocion)} - ${mostrarEstadoParlamentario(v.estado_parlamentario)}`}
                        </p>
                      </div>
                    </div>

                    <div className={`rounded-full border px-3 py-1 text-sm font-black ${claseResultado(v)}`}>
                      {mostrarResultado(v)}
                    </div>
                  </summary>

                  <div className="border-t border-slate-100 px-5 pb-5">
                    <div className="grid gap-3 py-4 md:grid-cols-3">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                          Emitidos
                        </p>
                        <p className="mt-1 text-2xl font-black">{v.emitidos}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                          Necesarios
                        </p>
                        <p className="mt-1 text-2xl font-black">{v.necesarios}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                          Estado
                        </p>
                        <p className="mt-1 text-lg font-black">{v.estado}</p>
                      </div>
                    </div>

                    {esEleccion ? (
                      <div className="space-y-3">
                        {v.candidatos?.map((c) => {
                          const pct = porcentaje(c.votos, totalCandidatos)

                          return (
                            <div key={c.nombre} className="rounded-lg border border-slate-100 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-black">{c.nombre}</p>
                                <p className="text-sm font-black">
                                  {c.votos} votos - {pct}%
                                </p>
                              </div>
                              <div className="mt-2 h-2 rounded-full bg-slate-100">
                                <div
                                  className="h-2 rounded-full bg-[#123c32]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-3">
                        {[
                          { label: "A favor", votos: v.favor, color: "bg-emerald-600" },
                          { label: "En contra", votos: v.contra, color: "bg-rose-600" },
                          { label: "Abstencion", votos: v.abstencion, color: "bg-slate-500" },
                        ].map((item) => {
                          const pct = porcentaje(item.votos, v.emitidos)

                          return (
                            <div key={item.label} className="rounded-lg border border-slate-100 p-3">
                              <div className="flex items-center justify-between">
                                <p className="font-black">{item.label}</p>
                                <p className="text-sm font-black">
                                  {item.votos} - {pct}%
                                </p>
                              </div>
                              <div className="mt-2 h-2 rounded-full bg-slate-100">
                                <div
                                  className={`h-2 rounded-full ${item.color}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
