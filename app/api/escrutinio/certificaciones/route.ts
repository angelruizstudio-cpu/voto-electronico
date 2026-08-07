import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { asambleaPerteneceAlTenant, obtenerTenantSesion } from "@/lib/tenant"
import { calcularResultadosVotacion } from "@/lib/resultadosVotacion"

function validarSesion(req: NextRequest) {
  return req.cookies.get("moderador_session")?.value === "true"
}

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function obtenerAsambleaPermitida(
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

  if (error || !asamblea) return null

  return asambleaPerteneceAlTenant(tenant, asamblea) ? asamblea : null

}

async function obtenerVotacionPermitida(
  req: NextRequest,
  supabaseAdmin: ReturnType<typeof crearSupabaseAdmin>,
  votacionId: string
) {
  const { data: votacion, error } = await supabaseAdmin
    .from("votaciones")
    .select("id, asamblea_id, titulo, estado, tipo_votacion, tipo_mayoria, ronda_numero, eleccion_grupo_id")
    .eq("id", votacionId)
    .maybeSingle()

  if (error || !votacion) return null

  const asamblea = await obtenerAsambleaPermitida(req, supabaseAdmin, votacion.asamblea_id)

  return asamblea ? { votacion, asamblea } : null
}

export async function GET(req: NextRequest) {
  if (!validarSesion(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const asambleaId = req.nextUrl.searchParams.get("asambleaId")

  if (!asambleaId) {
    return NextResponse.json({ ok: false, error: "FALTA_ASAMBLEA" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const asamblea = await obtenerAsambleaPermitida(req, supabaseAdmin, asambleaId)

  if (!asamblea) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from("resultados_escrutinio")
    .select("*")
    .eq("asamblea_id", asambleaId)
    .order("certificado_en", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, certificacion: data || null })
}

export async function POST(req: NextRequest) {
  if (!validarSesion(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { votacionId } = await req.json()

  if (!votacionId) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const permitido = await obtenerVotacionPermitida(req, supabaseAdmin, votacionId)

  if (!permitido) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 403 })
  }

  if (permitido.votacion.estado !== "cerrada") {
    return NextResponse.json({ ok: false, error: "CIERRA_VOTACION_PRIMERO" }, { status: 400 })
  }

  const { resultado, error: errorResultado } = await calcularResultadosVotacion(
    supabaseAdmin,
    permitido.votacion
  )

  if (errorResultado || !resultado) {
    return NextResponse.json(
      { ok: false, error: errorResultado?.message || "ERROR_CALCULAR_RESULTADO" },
      { status: 500 }
    )
  }

  const certificadoPor = req.cookies.get("auth_name")?.value || "Comité de Escrutinio"
  const certificadoEn = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from("resultados_escrutinio")
    .upsert(
      {
        organizacion_id: permitido.asamblea.organizacion_id,
        organizacion_slug: permitido.asamblea.organizacion_slug,
        asamblea_id: permitido.votacion.asamblea_id,
        votacion_id: votacionId,
        resultado,
        certificado_por: certificadoPor,
        certificado_en: certificadoEn,
        estado: "certificado",
        visto_moderador_en: null,
      },
      { onConflict: "votacion_id" }
    )
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, certificacion: data })
}
