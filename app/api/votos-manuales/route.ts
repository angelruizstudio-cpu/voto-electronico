import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  calcularNecesarios,
  calcularVotosValidosCandidatos,
  obtenerGanadorMayoriaSimple,
} from "@/lib/votacionHelpers"
import { obtenerTenantSesion } from "@/lib/tenant"

type VotoManualEntrada = {
  opcion?: "favor" | "contra" | "abstencion" | "nula" | "danada"
  candidatoId?: string
  candidatoNombre?: string
  cantidad: number
}

type VotoManualNormalizado = {
  votacion_id: string
  opcion: "favor" | "contra" | "abstencion" | "nula" | "danada" | null
  candidato_id: string | null
  cantidad: number
  registrado_por: string
  actualizado_en: string
}

type VotoManualGuardado = {
  opcion: "favor" | "contra" | "abstencion" | "nula" | "danada" | null
  candidato_id: string | null
  cantidad: number
}

type VotoElectronico = {
  opcion: "favor" | "contra" | "abstencion" | null
  candidato_id: string | null
}

type CandidatoManual = {
  id: string
  nombre: string
}

function validarSesion(req: NextRequest) {
  return req.cookies.get("moderador_session")?.value === "true"
}

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function validarVotacionDelTenant(
  req: NextRequest,
  supabaseAdmin: ReturnType<typeof crearSupabaseAdmin>,
  asambleaId: string
) {
  const tenant = obtenerTenantSesion(req)
  const { data: asamblea, error } = await supabaseAdmin
    .from("asambleas")
    .select("id, organizacion_id, organizacion_slug")
    .eq("id", asambleaId)
    .maybeSingle()

  if (error || !asamblea) {
    return false
  }

  if (tenant.id) {
    return asamblea.organizacion_id === tenant.id
  }

  return asamblea.organizacion_slug === tenant.slug
}

function normalizarCantidad(valor: unknown) {
  const numero = Number(valor)
  return Number.isFinite(numero) && numero >= 0 ? Math.floor(numero) : 0
}

function normalizarNombre(valor: unknown) {
  return String(valor || "").trim().replace(/\s+/g, " ")
}

async function contarVotantesManualesPresentes(
  supabaseAdmin: ReturnType<typeof crearSupabaseAdmin>,
  asambleaId: string
) {
  const { count, error } = await supabaseAdmin
    .from("asambleistas")
    .select("*", { count: "exact", head: true })
    .eq("asamblea_id", asambleaId)
    .eq("metodo_voto", "manual")
    .eq("presente", true)
    .eq("habilitado", true)

  return { count: count || 0, error }
}

async function calcularResultadosActualizados(
  supabaseAdmin: ReturnType<typeof crearSupabaseAdmin>,
  votacion: {
    id: string
    titulo: string
    tipo_votacion: string
    tipo_mayoria?: string | null
    ronda_numero?: number | null
    eleccion_grupo_id?: string | null
  }
) {
  const { data: votosData, error: errorVotos } = await supabaseAdmin
    .from("votos")
    .select("opcion, candidato_id")
    .eq("votacion_id", votacion.id)

  if (errorVotos) {
    return { resultado: null, error: errorVotos }
  }

  const { data: votosManualesData, error: errorManuales } = await supabaseAdmin
    .from("votos_manuales")
    .select("opcion, candidato_id, cantidad")
    .eq("votacion_id", votacion.id)

  if (errorManuales) {
    return { resultado: null, error: errorManuales }
  }

  const votos = (votosData || []) as VotoElectronico[]
  const votosManuales = (votosManualesData || []) as VotoManualGuardado[]
  const manuales = votosManuales.reduce((total, voto) => total + voto.cantidad, 0)
  const electronicos = votos.length
  const emitidos = electronicos + manuales
  const nulas = votosManuales.find((voto) => voto.opcion === "nula")?.cantidad || 0
  const danadas = votosManuales.find((voto) => voto.opcion === "danada")?.cantidad || 0

  if (votacion.tipo_votacion === "eleccion_lideres") {
    const { data: candidatosData, error: errorCandidatos } = await supabaseAdmin
      .from("candidatos")
      .select("id, nombre")
      .eq("votacion_id", votacion.id)
      .order("nombre", { ascending: true })

    if (errorCandidatos) {
      return { resultado: null, error: errorCandidatos }
    }

    const candidatos = (candidatosData || []) as CandidatoManual[]
    const conteoCandidatos = candidatos
      .map((candidato) => {
        const electronicosCandidato = votos.filter(
          (voto) => String(voto.candidato_id) === String(candidato.id)
        ).length
        const manualesCandidato = votosManuales
          .filter((voto) => String(voto.candidato_id) === String(candidato.id))
          .reduce((total, voto) => total + voto.cantidad, 0)
        const total = electronicosCandidato + manualesCandidato

        return {
          id: candidato.id,
          nombre: candidato.nombre,
          electronicos: electronicosCandidato,
          manuales: manualesCandidato,
          votos: total,
          porcentaje: emitidos > 0 ? Number(((total / emitidos) * 100).toFixed(2)) : 0,
        }
      })
      .sort((a, b) => b.votos - a.votos)

    const validosCandidatos = calcularVotosValidosCandidatos(conteoCandidatos)
    const necesarios = calcularNecesarios(validosCandidatos, "mayoria_simple")
    const ganador = obtenerGanadorMayoriaSimple(conteoCandidatos)
    const empateSorteo =
      (votacion.ronda_numero || 1) >= 3 &&
      conteoCandidatos.filter((candidato) => candidato.votos > 0).length === 2 &&
      validosCandidatos > 0 &&
      conteoCandidatos[0]?.votos === conteoCandidatos[1]?.votos
    const resultado = ganador
      ? "electo"
      : empateSorteo
      ? "empate_sorteo"
      : emitidos > 0 && (votacion.ronda_numero || 1) < 3
      ? "requiere_nueva_ronda"
      : "sin_eleccion"

    return {
      resultado: {
        tipo: "eleccion_lideres",
        votacionId: votacion.id,
        titulo: votacion.titulo,
        emitidos,
        electronicos,
        manuales,
        necesarios,
        nulas,
        danadas,
        rondaNumero: votacion.ronda_numero || 1,
        eleccionGrupoId: votacion.eleccion_grupo_id || votacion.id,
        resultado,
        ganadorId: ganador?.id || null,
        ganadorNombre: ganador?.nombre || null,
        candidatos: conteoCandidatos,
      },
      error: null,
    }
  }

  const favorElectronico = votos.filter((voto) => voto.opcion === "favor").length
  const contraElectronico = votos.filter((voto) => voto.opcion === "contra").length
  const abstencionElectronica = votos.filter((voto) => voto.opcion === "abstencion").length
  const favorManual = votosManuales.find((voto) => voto.opcion === "favor")?.cantidad || 0
  const contraManual = votosManuales.find((voto) => voto.opcion === "contra")?.cantidad || 0
  const abstencionManual =
    votosManuales.find((voto) => voto.opcion === "abstencion")?.cantidad || 0
  const favor = favorElectronico + favorManual
  const contra = contraElectronico + contraManual
  const abstencion = abstencionElectronica + abstencionManual
  const validos = favor + contra
  const necesarios = calcularNecesarios(validos, votacion.tipo_mayoria || "mayoria_simple")
  const aprobada = validos > 0 && favor >= necesarios

  return {
    resultado: {
      tipo: "resolucion",
      votacionId: votacion.id,
      titulo: votacion.titulo,
      emitidos,
      electronicos,
      manuales,
      favor,
      contra,
      abstencion,
      favorElectronico,
      contraElectronico,
      abstencionElectronica,
      favorManual,
      contraManual,
      abstencionManual,
      validos,
      necesarios,
      resultado: aprobada ? "aprobada" : "rechazada",
    },
    error: null,
  }
}

export async function GET(req: NextRequest) {
  if (!validarSesion(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const votacionId = req.nextUrl.searchParams.get("votacionId")

  if (!votacionId) {
    return NextResponse.json({ ok: false, error: "FALTA_VOTACION" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()

  const { data: votacion, error: errorVotacion } = await supabaseAdmin
    .from("votaciones")
    .select("id, titulo, estado, tipo_votacion, tipo_mayoria, ronda_numero, eleccion_grupo_id, asamblea_id")
    .eq("id", votacionId)
    .maybeSingle()

  if (errorVotacion || !votacion) {
    return NextResponse.json(
      { ok: false, error: errorVotacion?.message || "VOTACION_NO_EXISTE" },
      { status: 404 }
    )
  }

  const perteneceAlTenant = await validarVotacionDelTenant(req, supabaseAdmin, votacion.asamblea_id)

  if (!perteneceAlTenant) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 403 })
  }

  const { data: votosManuales, error: errorManuales } = await supabaseAdmin
    .from("votos_manuales")
    .select("*")
    .eq("votacion_id", votacionId)

  if (errorManuales) {
    return NextResponse.json({ ok: false, error: errorManuales.message }, { status: 500 })
  }

  const { count: votantesManualesPresentes, error: errorConteo } =
    await contarVotantesManualesPresentes(supabaseAdmin, votacion.asamblea_id)

  if (errorConteo) {
    return NextResponse.json({ ok: false, error: errorConteo.message }, { status: 500 })
  }

  const { resultado: resultadosActualizados, error: errorResultados } =
    await calcularResultadosActualizados(supabaseAdmin, votacion)

  if (errorResultados) {
    return NextResponse.json({ ok: false, error: errorResultados.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    votacion,
    votosManuales: votosManuales || [],
    votantesManualesPresentes,
    resultadosActualizados,
  })
}

export async function POST(req: NextRequest) {
  if (!validarSesion(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { votacionId, votos } = await req.json()

  if (!votacionId || !Array.isArray(votos)) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()

  const { data: votacion, error: errorVotacion } = await supabaseAdmin
    .from("votaciones")
    .select("id, titulo, estado, tipo_votacion, tipo_mayoria, ronda_numero, eleccion_grupo_id, asamblea_id")
    .eq("id", votacionId)
    .maybeSingle()

  if (errorVotacion || !votacion) {
    return NextResponse.json(
      { ok: false, error: errorVotacion?.message || "VOTACION_NO_EXISTE" },
      { status: 404 }
    )
  }

  const perteneceAlTenant = await validarVotacionDelTenant(req, supabaseAdmin, votacion.asamblea_id)

  if (!perteneceAlTenant) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 403 })
  }

  if (votacion.estado !== "cerrada") {
    return NextResponse.json(
      { ok: false, error: "CIERRA_VOTACION_PRIMERO" },
      { status: 400 }
    )
  }

  const filas: VotoManualNormalizado[] = []
  const registradoPor = req.cookies.get("auth_name")?.value || "Usuario autorizado"
  const actualizadoEn = new Date().toISOString()

  for (const voto of votos as VotoManualEntrada[]) {
    const cantidad = normalizarCantidad(voto.cantidad)
    const opcion = voto.opcion || null
    const candidatoNombre = normalizarNombre(voto.candidatoNombre)

    if (cantidad <= 0) continue

    if (voto.candidatoId) {
      filas.push({
        votacion_id: votacionId,
        opcion: null,
        candidato_id: voto.candidatoId,
        cantidad,
        registrado_por: registradoPor,
        actualizado_en: actualizadoEn,
      })
      continue
    }

    if (candidatoNombre) {
      if (votacion.tipo_votacion !== "eleccion_lideres" || (votacion.ronda_numero || 1) !== 1) {
        return NextResponse.json(
          { ok: false, error: "NOMBRES_MANUALES_SOLO_PRIMERA_RONDA" },
          { status: 400 }
        )
      }

      const { data: candidatoExistente, error: errorBuscarCandidato } = await supabaseAdmin
        .from("candidatos")
        .select("id, nombre, visible_asambleistas")
        .eq("votacion_id", votacionId)
        .ilike("nombre", candidatoNombre)
        .order("visible_asambleistas", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (errorBuscarCandidato) {
        return NextResponse.json(
          { ok: false, error: errorBuscarCandidato.message },
          { status: 500 }
        )
      }

      let candidatoId = candidatoExistente?.id

      if (!candidatoId) {
        const { data: candidatoCreado, error: errorCrearCandidato } = await supabaseAdmin
          .from("candidatos")
          .insert({
            votacion_id: votacionId,
            nombre: candidatoNombre,
            visible_asambleistas: false,
          })
          .select("id")
          .single()

        if (errorCrearCandidato || !candidatoCreado) {
          return NextResponse.json(
            { ok: false, error: errorCrearCandidato?.message || "ERROR_CANDIDATO_MANUAL" },
            { status: 500 }
          )
        }

        candidatoId = candidatoCreado.id
      }

      filas.push({
        votacion_id: votacionId,
        opcion: null,
        candidato_id: candidatoId,
        cantidad,
        registrado_por: registradoPor,
        actualizado_en: actualizadoEn,
      })
      continue
    }

    if (opcion) {
      filas.push({
        votacion_id: votacionId,
        opcion,
        candidato_id: null,
        cantidad,
        registrado_por: registradoPor,
        actualizado_en: actualizadoEn,
      })
    }
  }

  const totalManual = filas.reduce((total, voto) => total + voto.cantidad, 0)
  const { count: votantesManualesPresentes, error: errorConteo } =
    await contarVotantesManualesPresentes(supabaseAdmin, votacion.asamblea_id)

  if (errorConteo) {
    return NextResponse.json({ ok: false, error: errorConteo.message }, { status: 500 })
  }

  if (totalManual > votantesManualesPresentes) {
    return NextResponse.json(
      {
        ok: false,
        error: `Los votos manuales (${totalManual}) no pueden exceder los asambleistas manuales presentes (${votantesManualesPresentes}).`,
      },
      { status: 400 }
    )
  }

  const { error: errorBorrar } = await supabaseAdmin
    .from("votos_manuales")
    .delete()
    .eq("votacion_id", votacionId)

  if (errorBorrar) {
    return NextResponse.json({ ok: false, error: errorBorrar.message }, { status: 500 })
  }

  if (filas.length > 0) {
    const { error: errorInsertar } = await supabaseAdmin
      .from("votos_manuales")
      .insert(filas)

    if (errorInsertar) {
      return NextResponse.json({ ok: false, error: errorInsertar.message }, { status: 500 })
    }
  }

  const { resultado: resultadosActualizados, error: errorResultados } =
    await calcularResultadosActualizados(supabaseAdmin, votacion)

  if (errorResultados) {
    return NextResponse.json({ ok: false, error: errorResultados.message }, { status: 500 })
  }

  if (resultadosActualizados?.tipo === "resolucion") {
    const { error: errorActualizarResultado } = await supabaseAdmin
      .from("votaciones")
      .update({
        resultado: resultadosActualizados.resultado,
        estado_parlamentario: resultadosActualizados.resultado,
      })
      .eq("id", votacionId)

    if (errorActualizarResultado) {
      return NextResponse.json(
        { ok: false, error: errorActualizarResultado.message },
        { status: 500 }
      )
    }
  }

  if (resultadosActualizados?.tipo === "eleccion_lideres") {
    const { error: errorActualizarResultado } = await supabaseAdmin
      .from("votaciones")
      .update({
        resultado: resultadosActualizados.resultado,
        ganador_id: resultadosActualizados.ganadorId,
      })
      .eq("id", votacionId)

    if (errorActualizarResultado) {
      return NextResponse.json(
        { ok: false, error: errorActualizarResultado.message },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ ok: true, resultadosActualizados })
}
