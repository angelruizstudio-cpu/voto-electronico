import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

type VotoManualEntrada = {
  opcion?: "favor" | "contra" | "abstencion"
  candidatoId?: string
  cantidad: number
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

function normalizarCantidad(valor: unknown) {
  const numero = Number(valor)
  return Number.isFinite(numero) && numero >= 0 ? Math.floor(numero) : 0
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
    .select("id, titulo, estado, tipo_votacion")
    .eq("id", votacionId)
    .maybeSingle()

  if (errorVotacion || !votacion) {
    return NextResponse.json(
      { ok: false, error: errorVotacion?.message || "VOTACION_NO_EXISTE" },
      { status: 404 }
    )
  }

  const { data: votosManuales, error: errorManuales } = await supabaseAdmin
    .from("votos_manuales")
    .select("*")
    .eq("votacion_id", votacionId)

  if (errorManuales) {
    return NextResponse.json({ ok: false, error: errorManuales.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, votacion, votosManuales: votosManuales || [] })
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
    .select("id, estado")
    .eq("id", votacionId)
    .maybeSingle()

  if (errorVotacion || !votacion) {
    return NextResponse.json(
      { ok: false, error: errorVotacion?.message || "VOTACION_NO_EXISTE" },
      { status: 404 }
    )
  }

  if (votacion.estado !== "cerrada") {
    return NextResponse.json(
      { ok: false, error: "CIERRA_VOTACION_PRIMERO" },
      { status: 400 }
    )
  }

  const filas = (votos as VotoManualEntrada[])
    .map((voto) => ({
      votacion_id: votacionId,
      opcion: voto.opcion || null,
      candidato_id: voto.candidatoId || null,
      cantidad: normalizarCantidad(voto.cantidad),
      registrado_por: req.cookies.get("auth_name")?.value || "Usuario autorizado",
      actualizado_en: new Date().toISOString(),
    }))
    .filter((voto) => voto.cantidad > 0 && (voto.opcion || voto.candidato_id))

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

  return NextResponse.json({ ok: true })
}
