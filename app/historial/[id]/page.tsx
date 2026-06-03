"use client"

import { use, useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import {
  calcularNecesarios,
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

  const cargarDetalle = useCallback(async () => {
    const { data: asambleaData } = await supabase
      .from("asambleas")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    setAsamblea(asambleaData)

    const { data: votacionesData } = await supabase
      .from("votaciones")
      .select("*")
      .eq("asamblea_id", id)
      .order("titulo", { ascending: true })

    const detalles = await Promise.all(
      (votacionesData || []).map(async (votacion) => {
        const { data: votos } = await supabase
          .from("votos")
          .select("*")
          .eq("votacion_id", votacion.id)

        const { data: votosManuales } = await supabase
          .from("votos_manuales")
          .select("*")
          .eq("votacion_id", votacion.id)

        const manuales = (votosManuales || []).reduce(
          (total, voto) => total + Number(voto.cantidad || 0),
          0
        )
        const emitidos = (votos?.length || 0) + manuales
        const favor =
          (votos?.filter((v) => v.opcion === "favor").length || 0) +
          Number(votosManuales?.find((v) => v.opcion === "favor")?.cantidad || 0)
        const contra =
          (votos?.filter((v) => v.opcion === "contra").length || 0) +
          Number(votosManuales?.find((v) => v.opcion === "contra")?.cantidad || 0)
        const abstencion =
          (votos?.filter((v) => v.opcion === "abstencion").length || 0) +
          Number(votosManuales?.find((v) => v.opcion === "abstencion")?.cantidad || 0)

        let ganadorNombre = ""
        let candidatosConteo: { nombre: string; votos: number }[] = []

        if (votacion.tipo_votacion === "eleccion_lideres") {
          const { data: candidatos } = await supabase
            .from("candidatos")
            .select("*")
            .eq("votacion_id", votacion.id)
            .order("nombre", { ascending: true })

          candidatosConteo =
            candidatos?.map((candidato) => ({
              nombre: candidato.nombre,
              votos:
                (votos?.filter((v) => v.candidato_id === candidato.id).length || 0) +
                (votosManuales || [])
                  .filter((v) => v.candidato_id === candidato.id)
                  .reduce((total, voto) => total + Number(voto.cantidad || 0), 0),
            })) || []

          if (votacion.ganador_id) {
            const { data: ganador } = await supabase
              .from("candidatos")
              .select("*")
              .eq("id", votacion.ganador_id)
              .maybeSingle()

            ganadorNombre = ganador?.nombre || ""
          }
        }

        const necesarios = calcularNecesarios(
          votacion.tipo_votacion === "eleccion_lideres"
            ? calcularVotosValidosCandidatos(candidatosConteo)
            : favor + contra,
          votacion.tipo_mayoria
        )

        return {
          id: votacion.id,
          titulo: votacion.titulo,
          tipo_votacion: votacion.tipo_votacion || "resolucion",
          tipo_mayoria: votacion.tipo_mayoria,
          tipo_mocion: votacion.tipo_mocion || "resolucion_principal",
          estado_parlamentario: votacion.estado_parlamentario || null,
          estado: votacion.estado,
          resultado: votacion.resultado,
          ganadorNombre,
          ronda_numero: votacion.ronda_numero || undefined,
          eleccion_grupo_id: votacion.eleccion_grupo_id || null,
          mocion_padre_id: votacion.mocion_padre_id || null,
          resolucion_raiz_id: votacion.resolucion_raiz_id || null,
          emitidos,
          favor,
          contra,
          abstencion,
          necesarios,
          aprobado: favor >= necesarios && favor + contra > 0,
          candidatos: candidatosConteo,
        }
      })
    )

    setVotaciones(detalles)
  }, [id])

  const elecciones = votaciones.filter((v) => v.tipo_votacion === "eleccion_lideres")
  const resoluciones = votaciones.filter((v) => v.tipo_votacion === "resolucion")

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Detalle de Asamblea</h1>

          {asamblea && (
            <p className="text-slate-600">
              {asamblea.anio} — {asamblea.lugar}
            </p>
          )}
        </div>

        <Button onClick={descargarPDF} disabled={!asamblea}>
          Descargar PDF
        </Button>
      </div>

      {votaciones.length === 0 ? (
        <p>No hay votaciones en esta asamblea.</p>
      ) : (
        <div className="space-y-8">
          {elecciones.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold">Elecciones de líderes</h2>
              {elecciones.map((v) => (
                <div key={v.id} className="p-4 bg-white rounded-lg border space-y-3">
                  <div>
                    <p className="font-bold text-lg">{v.titulo}</p>
                    <p className="text-sm text-slate-600">
                      Ronda {v.ronda_numero || 1} · {mostrarTipoMayoria(v.tipo_mayoria)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <p>Emitidos: <span className="font-bold">{v.emitidos}</span></p>
                    <p>Necesarios: <span className="font-bold">{v.necesarios}</span></p>
                    <p className="col-span-2">
                      Resultado: <span className="font-bold">{mostrarResultado(v)}</span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    {v.candidatos?.map((c) => (
                      <div
                        key={c.nombre}
                        className="flex justify-between rounded border p-2"
                      >
                        <span>{c.nombre}</span>
                        <span className="font-bold">{c.votos}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {resoluciones.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold">Resoluciones y enmiendas</h2>
              {resoluciones.map((v) => (
                <div key={v.id} className="p-4 bg-white rounded-lg border space-y-3">
                  <div>
                    <p className="font-bold text-lg">{v.titulo}</p>
                    <p className="text-sm text-slate-600">
                      {mostrarTipoMocion(v.tipo_mocion)} ·{" "}
                      {mostrarEstadoParlamentario(v.estado_parlamentario)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                    <p>Emitidos: <span className="font-bold">{v.emitidos}</span></p>
                    <p>A favor: <span className="font-bold">{v.favor}</span></p>
                    <p>En contra: <span className="font-bold">{v.contra}</span></p>
                    <p>Abstención: <span className="font-bold">{v.abstencion}</span></p>
                    <p>Necesarios: <span className="font-bold">{v.necesarios}</span></p>
                    <p>
                      Resultado:{" "}
                      <span className={v.aprobado ? "font-bold text-green-600" : "font-bold text-red-600"}>
                        {mostrarResultado(v)}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
