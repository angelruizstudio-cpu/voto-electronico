import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { asambleaPerteneceAlTenant, obtenerTenantSesion } from "@/lib/tenant"

function validarSesion(req: NextRequest) {
  return req.cookies.get("moderador_session")?.value === "true"
}

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  if (!validarSesion(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const {
    asambleaId,
    titulo,
    tipoMayoria,
    tipoVotacion,
    tipoMocion,
    mocionPadreId,
    resolucionRaizId,
    candidatos,
    rondaNumero,
    eleccionGrupoId,
    votacionAnteriorId,
    cerrarVotacionAnterior,
  } = await req.json()

  const tituloLimpio = String(titulo || "").trim()
  const tipoVotacionLimpio =
    tipoVotacion === "eleccion_lideres" ? "eleccion_lideres" : "resolucion"
  const candidatosLimpios = Array.isArray(candidatos)
    ? candidatos.map((c) => String(c || "").trim()).filter(Boolean)
    : []

  if (!asambleaId || !tituloLimpio) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  if (tipoVotacionLimpio === "eleccion_lideres" && candidatosLimpios.length < 2) {
    return NextResponse.json({ ok: false, error: "CANDIDATOS_REQUERIDOS" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const tenant = obtenerTenantSesion(req)

  const { data: asamblea, error: errorAsamblea } = await supabaseAdmin
    .from("asambleas")
    .select("id, estado, organizacion_id, organizacion_slug")
    .eq("id", asambleaId)
    .maybeSingle()

  if (errorAsamblea) {
    return NextResponse.json({ ok: false, error: errorAsamblea.message }, { status: 500 })
  }

  if (!asamblea || !asambleaPerteneceAlTenant(tenant, asamblea)) {
    return NextResponse.json({ ok: false, error: "ASAMBLEA_NO_AUTORIZADA" }, { status: 403 })
  }

  if (asamblea.estado !== "abierta") {
    return NextResponse.json({ ok: false, error: "ASAMBLEA_NO_INICIADA" }, { status: 400 })
  }

  const rondaNumeroLimpia = Number.isFinite(Number(rondaNumero))
    ? Math.max(1, Math.floor(Number(rondaNumero)))
    : 1
  const esRondaPosterior = tipoVotacionLimpio === "eleccion_lideres" && rondaNumeroLimpia > 1

  if (cerrarVotacionAnterior && votacionAnteriorId) {
    const { data: votacionAnterior, error: errorAnterior } = await supabaseAdmin
      .from("votaciones")
      .select("id, asamblea_id")
      .eq("id", votacionAnteriorId)
      .maybeSingle()

    if (errorAnterior) {
      return NextResponse.json({ ok: false, error: errorAnterior.message }, { status: 500 })
    }

    if (!votacionAnterior || votacionAnterior.asamblea_id !== asambleaId) {
      return NextResponse.json({ ok: false, error: "VOTACION_ANTERIOR_NO_AUTORIZADA" }, { status: 403 })
    }

    const { error: errorCerrarAnterior } = await supabaseAdmin
      .from("votaciones")
      .update({ estado: "cerrada" })
      .eq("id", votacionAnteriorId)

    if (errorCerrarAnterior) {
      return NextResponse.json({ ok: false, error: errorCerrarAnterior.message }, { status: 500 })
    }
  }

  const datosVotacion = {
    titulo: tituloLimpio,
    asamblea_id: asambleaId,
    estado: tipoVotacionLimpio === "resolucion" ? "cerrada" : "abierta",
    tipo_mayoria:
      tipoVotacionLimpio === "resolucion" ? tipoMayoria || "mayoria_simple" : "mayoria_simple",
    tipo_votacion: tipoVotacionLimpio,
    publicada: false,
    ronda_numero: tipoVotacionLimpio === "eleccion_lideres" ? rondaNumeroLimpia : null,
    eleccion_grupo_id: esRondaPosterior ? eleccionGrupoId || votacionAnteriorId || null : null,
    votacion_anterior_id: esRondaPosterior ? votacionAnteriorId || null : null,
    estado_parlamentario:
      tipoVotacionLimpio === "resolucion" ? "esperando_segundo" : null,
    tipo_mocion:
      tipoVotacionLimpio === "resolucion" ? tipoMocion || "resolucion_principal" : null,
    mocion_padre_id:
      tipoVotacionLimpio === "resolucion" && mocionPadreId ? mocionPadreId : null,
    resolucion_raiz_id:
      tipoVotacionLimpio === "resolucion" && tipoMocion !== "resolucion_principal"
        ? resolucionRaizId || mocionPadreId || null
        : null,
  }

  const { data: votacionCreada, error: errorVotacion } = await supabaseAdmin
    .from("votaciones")
    .insert(datosVotacion)
    .select()
    .single()

  if (errorVotacion || !votacionCreada) {
    return NextResponse.json(
      { ok: false, error: errorVotacion?.message || "ERROR_CREAR_VOTACION" },
      { status: 500 }
    )
  }

  if (
    tipoVotacionLimpio === "resolucion" &&
    (tipoMocion || "resolucion_principal") === "resolucion_principal"
  ) {
    const { error: errorRaiz } = await supabaseAdmin
      .from("votaciones")
      .update({ resolucion_raiz_id: votacionCreada.id })
      .eq("id", votacionCreada.id)

    if (errorRaiz) {
      return NextResponse.json({ ok: false, error: errorRaiz.message }, { status: 500 })
    }
  }

  if (tipoVotacionLimpio === "eleccion_lideres") {
    const { error: errorGrupo } = await supabaseAdmin
      .from("votaciones")
      .update({ eleccion_grupo_id: eleccionGrupoId || votacionCreada.eleccion_grupo_id || votacionCreada.id })
      .eq("id", votacionCreada.id)

    if (errorGrupo) {
      return NextResponse.json({ ok: false, error: errorGrupo.message }, { status: 500 })
    }

    const { error: errorCandidatos } = await supabaseAdmin.from("candidatos").insert(
      candidatosLimpios.map((nombre) => ({
        votacion_id: votacionCreada.id,
        nombre,
        visible_asambleistas: true,
      }))
    )

    if (errorCandidatos) {
      return NextResponse.json({ ok: false, error: errorCandidatos.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, votacion: votacionCreada })
}

export async function PATCH(req: NextRequest) {
  if (!validarSesion(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { votacionId, cambios } = await req.json()

  if (!votacionId || !cambios || typeof cambios !== "object") {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const tenant = obtenerTenantSesion(req)

  const { data: votacion, error: errorVotacion } = await supabaseAdmin
    .from("votaciones")
    .select("id, asamblea_id")
    .eq("id", votacionId)
    .maybeSingle()

  if (errorVotacion) {
    return NextResponse.json({ ok: false, error: errorVotacion.message }, { status: 500 })
  }

  if (!votacion) {
    return NextResponse.json({ ok: false, error: "VOTACION_NO_EXISTE" }, { status: 404 })
  }

  const { data: asamblea, error: errorAsamblea } = await supabaseAdmin
    .from("asambleas")
    .select("id, organizacion_id, organizacion_slug")
    .eq("id", votacion.asamblea_id)
    .maybeSingle()

  if (errorAsamblea) {
    return NextResponse.json({ ok: false, error: errorAsamblea.message }, { status: 500 })
  }

  if (!asamblea || !asambleaPerteneceAlTenant(tenant, asamblea)) {
    return NextResponse.json({ ok: false, error: "ASAMBLEA_NO_AUTORIZADA" }, { status: 403 })
  }

  const camposPermitidos = [
    "estado",
    "resultado",
    "ganador_id",
    "estado_parlamentario",
    "publicada",
  ]

  const cambiosPermitidos = Object.fromEntries(
    Object.entries(cambios).filter(([campo]) => camposPermitidos.includes(campo))
  )

  if (Object.keys(cambiosPermitidos).length === 0) {
    return NextResponse.json({ ok: false, error: "SIN_CAMBIOS_VALIDOS" }, { status: 400 })
  }

  const { data: votacionActualizada, error: errorActualizar } = await supabaseAdmin
    .from("votaciones")
    .update(cambiosPermitidos)
    .eq("id", votacionId)
    .select()
    .single()

  if (errorActualizar || !votacionActualizada) {
    return NextResponse.json(
      { ok: false, error: errorActualizar?.message || "ERROR_ACTUALIZAR_VOTACION" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, votacion: votacionActualizada })
}
