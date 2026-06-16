import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { limpiarCodigoAccesoOrganizacion, limpiarSlugOrganizacion } from "@/lib/tenant"

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const asambleaId = searchParams.get("asambleaId")
  const token = searchParams.get("token")
  const org = searchParams.get("org")

  if (!asambleaId) {
    return NextResponse.json({ ok: false, error: "ASAMBLEA_REQUERIDA" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const orgSlug = limpiarSlugOrganizacion(org)
  const orgCode = limpiarCodigoAccesoOrganizacion(org)

  let organizacionId: string | null = null

  if (org) {
    const { data: organizacion } = await supabaseAdmin
      .from("organizaciones")
      .select("id")
      .or(`slug.eq.${orgSlug},codigo_acceso.eq.${orgCode}`)
      .eq("activa", true)
      .maybeSingle()

    organizacionId = organizacion?.id || null
  }

  let queryAsamblea = supabaseAdmin
    .from("asambleas")
    .select("id")
    .eq("id", asambleaId)
    .in("estado", ["abierta", "receso"])

  if (organizacionId) {
    queryAsamblea = queryAsamblea.eq("organizacion_id", organizacionId)
  } else if (orgSlug) {
    queryAsamblea = queryAsamblea.eq("organizacion_slug", orgSlug)
  }

  const { data: asamblea, error: errorAsamblea } = await queryAsamblea.maybeSingle()

  if (errorAsamblea) {
    return NextResponse.json({ ok: false, error: errorAsamblea.message }, { status: 500 })
  }

  if (!asamblea) {
    return NextResponse.json({ ok: true, votacion: null, votos: [], candidatos: [], yaVoto: false })
  }

  const { data: votacion, error: errorVotacion } = await supabaseAdmin
    .from("votaciones")
    .select("*")
    .eq("asamblea_id", asamblea.id)
    .eq("estado", "abierta")
    .order("creada_en", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (errorVotacion) {
    return NextResponse.json({ ok: false, error: errorVotacion.message }, { status: 500 })
  }

  if (!votacion) {
    return NextResponse.json({ ok: true, votacion: null, votos: [], candidatos: [], yaVoto: false })
  }

  const [{ data: votosData }, { data: candidatosData }] = await Promise.all([
    supabaseAdmin.from("votos").select("*").eq("votacion_id", votacion.id),
    votacion.tipo_votacion === "eleccion_lideres"
      ? supabaseAdmin.from("candidatos").select("*").eq("votacion_id", votacion.id).order("nombre")
      : Promise.resolve({ data: [] }),
  ])

  let yaVoto = false

  if (token) {
    const { data: tokenRow } = await supabaseAdmin
      .from("tokens_acceso")
      .select("id")
      .eq("token_hash", token)
      .maybeSingle()

    yaVoto = Boolean(tokenRow && (votosData || []).some((voto) => voto.token_id === tokenRow.id))
  }

  return NextResponse.json({
    ok: true,
    votacion,
    votos: votosData || [],
    candidatos: candidatosData || [],
    yaVoto,
  })
}
