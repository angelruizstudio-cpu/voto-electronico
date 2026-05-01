"use client"

import { use, useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
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
  estado: string
  resultado?: string
  ganadorNombre?: string
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

export default function DetalleAsamblea({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [asamblea, setAsamblea] = useState<Asamblea | null>(null)
  const [votaciones, setVotaciones] = useState<VotacionDetalle[]>([])

  const calcularNecesarios = (total: number, tipo: string) => {
    if (total === 0) return 0
    if (tipo === "dos_tercios") return Math.ceil((2 / 3) * total)
    return Math.floor(total / 2) + 1
  }

  const mostrarTipoVotacion = (tipo: string) => {
    if (tipo === "eleccion_lideres") return "Elección de Líderes Regionales"
    return "Resolución"
  }

  const mostrarTipoMayoria = (tipo: string) => {
    if (tipo === "dos_tercios") return "Dos terceras partes"
    return "Mayoría simple"
  }

  const cargarDetalle = async () => {
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

        const emitidos = votos?.length || 0
        const favor = votos?.filter((v) => v.opcion === "favor").length || 0
        const contra = votos?.filter((v) => v.opcion === "contra").length || 0
        const abstencion =
          votos?.filter((v) => v.opcion === "abstencion").length || 0

        const necesarios = calcularNecesarios(
          votacion.tipo_votacion === "eleccion_lideres"
            ? emitidos
            : favor + contra,
          votacion.tipo_mayoria
        )

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
                votos?.filter((v) => v.candidato_id === candidato.id).length ||
                0,
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

        return {
          id: votacion.id,
          titulo: votacion.titulo,
          tipo_votacion: votacion.tipo_votacion || "resolucion",
          tipo_mayoria: votacion.tipo_mayoria,
          estado: votacion.estado,
          resultado: votacion.resultado,
          ganadorNombre,
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
  }

  const descargarPDF = () => {
    if (!asamblea) return

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text("Informe de Resultados de Asamblea", 14, 15)

    doc.setFontSize(11)
    doc.text(`Año: ${asamblea.anio}`, 14, 25)
    doc.text(`Lugar: ${asamblea.lugar}`, 14, 32)
    doc.text(`Estado: ${asamblea.estado}`, 14, 39)
    doc.text('Documento: ARCHIVO HISTÓRICO', 14, 46)

    const filas = votaciones.map((v) => [
      v.titulo,
      mostrarTipoVotacion(v.tipo_votacion),
      mostrarTipoMayoria(v.tipo_mayoria),
      v.emitidos,
      v.tipo_votacion === "eleccion_lideres" ? "-" : v.favor,
      v.tipo_votacion === "eleccion_lideres" ? "-" : v.contra,
      v.necesarios,
      v.tipo_votacion === "eleccion_lideres"
        ? v.ganadorNombre || v.resultado || "Procesado"
        : v.aprobado
        ? "Aprobado"
        : "No aprobado",
    ])

    autoTable(doc, {
      startY: 50,
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

    const finalY = (doc as any).lastAutoTable.finalY || 70

    doc.text("Firmas oficiales", 14, finalY + 20)

    doc.line(14, finalY + 35, 90, finalY + 35)
    doc.text("Presidente Comité de Escrutinio", 14, finalY + 42)

    doc.line(110, finalY + 35, 190, finalY + 35)
    doc.text("Presidente", 110, finalY + 42)

    doc.save(`Asamblea_${asamblea.anio}_${asamblea.lugar}.pdf`)
  }

  useEffect(() => {
    cargarDetalle()
  }, [id])

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
        <div className="space-y-4">
          {votaciones.map((v) => (
            <div key={v.id} className="p-4 bg-white rounded-lg border space-y-3">
              <p className="font-bold text-lg">{v.titulo}</p>

              <p>Tipo: {mostrarTipoVotacion(v.tipo_votacion)}</p>
              <p>Mayoría: {mostrarTipoMayoria(v.tipo_mayoria)}</p>
              <p>
                Estado:{" "}
                <span className="font-bold text-red-600">{v.estado}</span>
              </p>

              {v.tipo_votacion === "eleccion_lideres" ? (
                <>
                  <p className="font-bold text-green-600">
                    {v.ganadorNombre
                      ? `Ganador: ${v.ganadorNombre}`
                      : `Resultado: ${v.resultado || "Procesado"}`}
                  </p>

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
                </>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <p>Emitidos: {v.emitidos}</p>
                  <p>A favor: {v.favor}</p>
                  <p>En contra: {v.contra}</p>
                  <p>Abstención: {v.abstencion}</p>
                  <p>Necesarios: {v.necesarios}</p>
                  <p
                    className={
                      v.aprobado
                        ? "font-bold text-green-600"
                        : "font-bold text-red-600"
                    }
                  >
                    {v.aprobado ? "Aprobado" : "No aprobado"}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}