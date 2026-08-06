import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { asambleaPerteneceAlTenant, obtenerTenantSesion } from "@/lib/tenant"

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const asambleaId = req.nextUrl.searchParams.get("asambleaId")
  const modoAsambleista = req.nextUrl.searchParams.get("modo") === "asambleista"
  const incluirResultados = req.nextUrl.searchParams.get("resultados") === "1"
  const votacionActualId = req.nextUrl.searchParams.get("actual")

  if (!asambleaId) {
    return NextResponse.json({ ok: false, error: "ASAMBLEA_REQUERIDA" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  let tokenId: string | null = null

  if (modoAsambleista) {
    const token = req.headers.get("x-voting-token")

    if (!token) {
      return NextResponse.json({ ok: false, error: "TOKEN_REQUERIDO" }, { status: 401 })
    }

    const { data: tokenRow } = await supabaseAdmin
      .from("tokens_acceso")
      .select("id, asamblea_id")
      .eq("token_hash", token)
      .eq("activo", true)
      .eq("bloqueado", false)
      .maybeSingle()

    if (!tokenRow || tokenRow.asamblea_id !== asambleaId) {
      return NextResponse.json({ ok: false, error: "TOKEN_INVALIDO" }, { status: 401 })
    }

    tokenId = tokenRow.id
  } else {
    const sesionValida =
      req.cookies.get("auth_session")?.value === "true" ||
      req.cookies.get("moderador_session")?.value === "true"

    if (!sesionValida) {
      return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
    }

    const { data: asamblea } = await supabaseAdmin
      .from("asambleas")
      .select("id, organizacion_id, organizacion_slug")
      .eq("id", asambleaId)
      .maybeSingle()

    if (!asamblea || !asambleaPerteneceAlTenant(obtenerTenantSesion(req), asamblea)) {
      return NextResponse.json({ ok: false, error: "ASAMBLEA_NO_AUTORIZADA" }, { status: 403 })
    }
  }

  const { data: votacion, error: errorVotacion } = await supabaseAdmin
    .from("votaciones")
    .select(
      "id, titulo, estado, tipo_mayoria, tipo_votacion, tipo_mocion, mocion_padre_id, resolucion_raiz_id, publicada, ronda_numero, eleccion_grupo_id"
    )
    .eq("asamblea_id", asambleaId)
    .eq("estado", "abierta")
    .order("creada_en", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (errorVotacion) {
    return NextResponse.json({ ok: false, error: errorVotacion.message }, { status: 500 })
  }

  if (!votacion) {
    return NextResponse.json({ ok: true, votacion: null }, { headers: { "Cache-Control": "no-store" } })
  }

  if (modoAsambleista && !incluirResultados && votacionActualId === votacion.id) {
    return NextResponse.json(
      { ok: true, sinCambios: true },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  const debeIncluirConteos = !modoAsambleista || (incluirResultados && votacion.publicada)
  const [respuestaVotos, respuestaCandidatos, respuestaYaVoto] = await Promise.all([
    debeIncluirConteos
      ? supabaseAdmin
          .from("votos")
          .select("opcion, candidato_id")
          .eq("votacion_id", votacion.id)
      : Promise.resolve({ data: [], error: null }),
    votacion.tipo_votacion === "eleccion_lideres"
      ? supabaseAdmin
          .from("candidatos")
          .select("id, nombre, votacion_id, visible_asambleistas")
          .eq("votacion_id", votacion.id)
          .order("nombre", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    tokenId
      ? supabaseAdmin
          .from("votos")
          .select("id", { count: "exact", head: true })
          .eq("votacion_id", votacion.id)
          .eq("token_id", tokenId)
      : Promise.resolve({ count: 0, error: null }),
  ])

  if (respuestaVotos.error || respuestaCandidatos.error || respuestaYaVoto.error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          respuestaVotos.error?.message ||
          respuestaCandidatos.error?.message ||
          respuestaYaVoto.error?.message,
      },
      { status: 500 }
    )
  }

  const votos = respuestaVotos.data || []
  const candidatos =
    modoAsambleista && (votacion.ronda_numero || 1) === 1
      ? (respuestaCandidatos.data || []).filter(
          (candidato) => candidato.visible_asambleistas !== false
        )
      : respuestaCandidatos.data || []
  const votosEmitidos = votos.length
  const conteoCandidatos = candidatos.map((candidato) => {
    const votosCandidato = votos.filter(
      (voto) => String(voto.candidato_id) === String(candidato.id)
    ).length

    return {
      ...candidato,
      votos: votosCandidato,
      porcentaje:
        votosEmitidos > 0 ? Number(((votosCandidato / votosEmitidos) * 100).toFixed(2)) : 0,
    }
  })

  return NextResponse.json(
    {
      ok: true,
      votacion,
      candidatos,
      conteoCandidatos,
      votosEmitidos,
      votosAFavor: votos.filter((voto) => voto.opcion === "favor").length,
      votosEnContra: votos.filter((voto) => voto.opcion === "contra").length,
      votosAbstencion: votos.filter((voto) => voto.opcion === "abstencion").length,
      yaVoto: (respuestaYaVoto.count || 0) > 0,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
