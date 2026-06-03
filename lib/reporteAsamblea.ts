import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { supabase } from "@/lib/supabaseClient"
import {
  calcularNecesarios,
  calcularVotosValidosCandidatos,
  mostrarEstadoParlamentario,
  mostrarTipoMayoria,
  mostrarTipoMocion,
  mostrarTipoVotacion,
} from "@/lib/votacionHelpers"

type Asamblea = {
  id: string
  anio: number
  lugar: string
  estado: string
}

type VotacionReporte = {
  id: string
  titulo: string
  tipo_votacion: string
  tipo_mayoria: string
  tipo_mocion: string
  estado_parlamentario: string | null
  estado: string
  resultado?: string | null
  ganador_id?: string | null
  ronda_numero?: number | null
  eleccion_grupo_id?: string | null
  emitidos: number
  manuales: number
  favor: number
  contra: number
  abstencion: number
  necesarios: number
  aprobado: boolean
  ganadorNombre?: string
  candidatos?: {
    nombre: string
    votos: number
  }[]
}

type AsambleaEvento = {
  id: string
  tipo: string
  descripcion: string | null
  creado_en: string
}

type PdfConAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY?: number
  }
}

const mostrarResultado = (v: VotacionReporte) => {
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

const nombreArchivoSeguro = (valor: string) =>
  valor
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")

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

const obtenerTituloCargo = (titulo: string) =>
  titulo.replace(/\s+-\s+Ronda\s+\d+$/i, "").trim().toUpperCase()

const textoEleccion = (votacion?: VotacionReporte) => {
  if (!votacion) return ""
  if (votacion.resultado === "electo" || votacion.resultado === "electo_por_sorteo") {
    return "Sí"
  }

  return "No"
}

const mostrarRondaActa = (numero: number) => {
  if (numero === 1) return "1ra. Ronda"
  if (numero === 2) return "2da. Ronda"
  if (numero === 3) return "3ra. Ronda"
  return `${numero}ta. Ronda`
}

const mostrarTipoEvento = (tipo: string) => {
  if (tipo === "receso_iniciado") return "Receso iniciado"
  if (tipo === "trabajos_reanudados") return "Trabajos reanudados"
  return tipo
}

const formatearFechaEvento = (fecha: string) =>
  new Date(fecha).toLocaleDateString("es-PR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

const formatearHoraEvento = (fecha: string) =>
  new Date(fecha).toLocaleTimeString("es-PR", {
    hour: "numeric",
    minute: "2-digit",
  })

const agregarActaElecciones = (
  doc: jsPDF,
  votaciones: VotacionReporte[],
  startY: number
) => {
  const elecciones = votaciones.filter((v) => v.tipo_votacion === "eleccion_lideres")

  if (elecciones.length === 0) return startY

  const grupos = elecciones.reduce<Record<string, VotacionReporte[]>>((acc, votacion) => {
    const llave = votacion.eleccion_grupo_id || obtenerTituloCargo(votacion.titulo)
    acc[llave] = acc[llave] || []
    acc[llave].push(votacion)
    return acc
  }, {})

  let yActual = startY
  const margenIzquierdo = 14
  const margenDerecho = 14
  const anchoPagina = doc.internal.pageSize.getWidth()
  const anchoTabla = anchoPagina - margenIzquierdo - margenDerecho
  const anchoMitadTabla = anchoTabla / 2
  const anchoCandidato = 38
  const anchoEmitidos = 16
  const anchoNecesarios = 20
  const anchoEleccion = anchoMitadTabla - anchoCandidato - anchoEmitidos - anchoNecesarios

  doc.setFontSize(13)
  doc.text("Acta de Elecciones de Líderes", margenIzquierdo, yActual)
  yActual += 6

  Object.values(grupos).forEach((rondas) => {
    const rondasOrdenadas = rondas
      .slice()
      .sort((a, b) => (a.ronda_numero || 1) - (b.ronda_numero || 1))
    const cargo = obtenerTituloCargo(rondasOrdenadas[0]?.titulo || "ELECCIÓN")

    for (let index = 0; index < rondasOrdenadas.length; index += 2) {
      if (yActual > 230) {
        doc.addPage()
        yActual = 15
      }

      const rondaIzquierda = rondasOrdenadas[index]
      const rondaDerecha = rondasOrdenadas[index + 1]
      const maxCandidatos = Math.max(
        8,
        rondaIzquierda?.candidatos?.length || 0,
        rondaDerecha?.candidatos?.length || 0
      )

      const filas = Array.from({ length: maxCandidatos }).map((_, filaIndex) => {
        const candidatoIzquierdo = rondaIzquierda?.candidatos?.[filaIndex]
        const candidatoDerecho = rondaDerecha?.candidatos?.[filaIndex]

        return [
          candidatoIzquierdo
            ? `${candidatoIzquierdo.nombre} - ${candidatoIzquierdo.votos}`
            : "",
          filaIndex === 0 && rondaIzquierda ? String(rondaIzquierda.emitidos) : "",
          filaIndex === 0 && rondaIzquierda ? String(rondaIzquierda.necesarios) : "",
          filaIndex === 0 ? textoEleccion(rondaIzquierda) : "",
          candidatoDerecho ? `${candidatoDerecho.nombre} - ${candidatoDerecho.votos}` : "",
          filaIndex === 0 && rondaDerecha ? String(rondaDerecha.emitidos) : "",
          filaIndex === 0 && rondaDerecha ? String(rondaDerecha.necesarios) : "",
          filaIndex === 0 ? textoEleccion(rondaDerecha) : "",
        ]
      })

      autoTable(doc, {
        startY: yActual,
        head: [
          [{ content: cargo, colSpan: 8, styles: { halign: "center", fontSize: 12 } }],
          [
            "Candidato - votos",
            "Votos\nEmitidos",
            "Votos\nNecesarios",
            "Elección\nSí - No",
            "Candidato - votos",
            "Votos\nEmitidos",
            "Votos\nNecesarios",
            "Elección\nSí - No",
          ],
          [
            {
              content: mostrarRondaActa(rondaIzquierda?.ronda_numero || index + 1),
              colSpan: 4,
              styles: { halign: "center", fontStyle: "bold" },
            },
            {
              content: rondaDerecha
                ? mostrarRondaActa(rondaDerecha.ronda_numero || index + 2)
                : "",
              colSpan: 4,
              styles: { halign: "center", fontStyle: "bold" },
            },
          ],
        ],
        body: filas,
        theme: "grid",
        styles: {
          fontSize: 6.5,
          cellPadding: 1.2,
          lineColor: [90, 90, 90],
          lineWidth: 0.1,
          minCellHeight: 7,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          lineColor: [90, 90, 90],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: anchoCandidato },
          1: { cellWidth: anchoEmitidos, halign: "center" },
          2: { cellWidth: anchoNecesarios, halign: "center" },
          3: { cellWidth: anchoEleccion, halign: "center" },
          4: { cellWidth: anchoCandidato },
          5: { cellWidth: anchoEmitidos, halign: "center" },
          6: { cellWidth: anchoNecesarios, halign: "center" },
          7: { cellWidth: anchoEleccion, halign: "center" },
        },
        margin: { left: margenIzquierdo, right: margenDerecho },
        tableWidth: anchoTabla,
      })

      yActual = ((doc as PdfConAutoTable).lastAutoTable?.finalY || yActual) + 8
    }
  })

  return yActual
}

export async function generarReporteCierreAsamblea(asambleaId: string) {
  const { data: asamblea, error: errorAsamblea } = await supabase
    .from("asambleas")
    .select("*")
    .eq("id", asambleaId)
    .maybeSingle()

  if (errorAsamblea || !asamblea) {
    throw new Error(errorAsamblea?.message || "No se encontró la asamblea")
  }

  const { data: votacionesData, error: errorVotaciones } = await supabase
    .from("votaciones")
    .select("*")
    .eq("asamblea_id", asambleaId)
    .order("creada_en", { ascending: true })

  if (errorVotaciones) {
    throw new Error(errorVotaciones.message)
  }

  const votaciones = await Promise.all(
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
      const emitidosElectronicos = votos?.length || 0
      const emitidos = emitidosElectronicos + manuales
      const favorElectronico = votos?.filter((v) => v.opcion === "favor").length || 0
      const contraElectronico = votos?.filter((v) => v.opcion === "contra").length || 0
      const abstencionElectronica = votos?.filter((v) => v.opcion === "abstencion").length || 0
      const favorManual =
        votosManuales?.find((v) => v.opcion === "favor")?.cantidad || 0
      const contraManual =
        votosManuales?.find((v) => v.opcion === "contra")?.cantidad || 0
      const abstencionManual =
        votosManuales?.find((v) => v.opcion === "abstencion")?.cantidad || 0
      const favor = favorElectronico + favorManual
      const contra = contraElectronico + contraManual
      const abstencion = abstencionElectronica + abstencionManual

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
        ganador_id: votacion.ganador_id,
        ronda_numero: votacion.ronda_numero || undefined,
        eleccion_grupo_id: votacion.eleccion_grupo_id || null,
        emitidos,
        manuales,
        favor,
        contra,
        abstencion,
        necesarios,
        aprobado: favor >= necesarios && favor + contra > 0,
        ganadorNombre,
        candidatos: candidatosConteo,
      }
    })
  )

  const { data: eventosData, error: errorEventos } = await supabase
    .from("asamblea_eventos")
    .select("*")
    .eq("asamblea_id", asambleaId)
    .in("tipo", ["receso_iniciado", "trabajos_reanudados"])
    .order("creado_en", { ascending: true })

  if (errorEventos) {
    throw new Error(errorEventos.message)
  }

  const eventos = (eventosData || []) as AsambleaEvento[]

  const doc = new jsPDF()
  const asambleaReporte = asamblea as Asamblea
  const fechaCierre = new Date().toLocaleString("es-PR")
  const logoOficial = await cargarLogoOficial()

  if (logoOficial) {
    doc.addImage(logoOficial, "PNG", 14, 9, 32, 18)
  }

  doc.setFontSize(16)
  doc.text("Reporte de Cierre de Asamblea", logoOficial ? 52 : 14, 15)

  doc.setFontSize(11)
  doc.text(`Año: ${asambleaReporte.anio}`, logoOficial ? 52 : 14, 25)
  doc.text(`Lugar: ${asambleaReporte.lugar}`, logoOficial ? 52 : 14, 32)
  doc.text(`Estado: ${asambleaReporte.estado}`, 14, 42)
  doc.text(`Fecha de cierre: ${fechaCierre}`, 14, 49)
  doc.text(`Total de asuntos registrados: ${votaciones.length}`, 14, 56)

  autoTable(doc, {
    startY: 64,
    head: [[
      "Asunto",
      "Tipo",
      "Mayoría",
      "Emitidos",
      "Manuales",
      "A favor",
      "En contra",
      "Necesarios",
      "Resultado",
    ]],
    body: votaciones.map((v) => [
      v.titulo,
      v.tipo_votacion === "resolucion"
        ? `${mostrarTipoMocion(v.tipo_mocion)} - ${mostrarEstadoParlamentario(v.estado_parlamentario)}`
        : `${mostrarTipoVotacion(v.tipo_votacion)}${v.ronda_numero ? ` - Ronda ${v.ronda_numero}` : ""}`,
      mostrarTipoMayoria(v.tipo_mayoria),
      v.emitidos,
      v.manuales,
      v.tipo_votacion === "eleccion_lideres" ? "-" : v.favor,
      v.tipo_votacion === "eleccion_lideres" ? "-" : v.contra,
      v.necesarios,
      mostrarResultado(v),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [20, 45, 85] },
  })

  let siguienteY = ((doc as PdfConAutoTable).lastAutoTable?.finalY || 70) + 12

  if (eventos.length > 0) {
    autoTable(doc, {
      startY: siguienteY,
      head: [["Evento", "Fecha", "Hora", "Detalle"]],
      body: eventos.map((evento) => [
        mostrarTipoEvento(evento.tipo),
        formatearFechaEvento(evento.creado_en),
        formatearHoraEvento(evento.creado_en),
        evento.descripcion || "",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 45, 85] },
    })

    siguienteY = ((doc as PdfConAutoTable).lastAutoTable?.finalY || siguienteY) + 12
  }

  const firmasY = agregarActaElecciones(doc, votaciones, siguienteY)

  doc.text("Firmas oficiales", 14, firmasY + 20)

  doc.line(14, firmasY + 35, 90, firmasY + 35)
  doc.text("Presidente Comité de Escrutinio", 14, firmasY + 42)

  doc.line(110, firmasY + 35, 190, firmasY + 35)
  doc.text("Presidente", 110, firmasY + 42)

  doc.save(
    `Reporte_Cierre_Asamblea_${asambleaReporte.anio}_${nombreArchivoSeguro(
      asambleaReporte.lugar
    )}.pdf`
  )
}
