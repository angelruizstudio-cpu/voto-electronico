import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  try {
    const userAgent = req.headers.get("user-agent") || "unknown"
    const forwardedFor = req.headers.get("x-forwarded-for")
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown"
    const { token, votacionId, nombre, deviceId } = await req.json()
    const nombreLimpio = String(nombre || "").trim()

    if (!token || !votacionId || !deviceId || nombreLimpio.length < 2) {
      return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
    }

    const supabaseAdmin = crearSupabaseAdmin()

    const { data: tokenRow } = await supabaseAdmin
      .from("tokens_acceso")
      .select("id, asamblea_id, asambleista_id, activo, bloqueado, expira_en")
      .eq("token_hash", token)
      .eq("activo", true)
      .eq("bloqueado", false)
      .gt("expira_en", new Date().toISOString())
      .maybeSingle()

    if (!tokenRow) {
      return NextResponse.json({ ok: false, error: "TOKEN_INVALIDO" }, { status: 401 })
    }

    const { data: asambleista } = await supabaseAdmin
      .from("asambleistas")
      .select("habilitado, presente, dispositivo_autorizado_id, dispositivo_alerta_en")
      .eq("id", tokenRow.asambleista_id)
      .eq("asamblea_id", tokenRow.asamblea_id)
      .maybeSingle()

    if (!asambleista?.habilitado) {
      return NextResponse.json({ ok: false, error: "NO_HABILITADO" }, { status: 403 })
    }

    if (asambleista.dispositivo_alerta_en) {
      return NextResponse.json({ ok: false, error: "DISPOSITIVO_REVALIDACION_REQUERIDA" }, { status: 403 })
    }

    if (
      asambleista.dispositivo_autorizado_id &&
      asambleista.dispositivo_autorizado_id !== String(deviceId).trim()
    ) {
      return NextResponse.json({ ok: false, error: "DISPOSITIVO_REVALIDACION_REQUERIDA" }, { status: 403 })
    }

    if (!asambleista.presente) {
      return NextResponse.json({ ok: false, error: "NO_PRESENTE" }, { status: 403 })
    }

    const { data: votacion } = await supabaseAdmin
      .from("votaciones")
      .select("id, asamblea_id, estado, tipo_votacion, ronda_numero")
      .eq("id", votacionId)
      .eq("asamblea_id", tokenRow.asamblea_id)
      .eq("estado", "abierta")
      .eq("tipo_votacion", "eleccion_lideres")
      .maybeSingle()

    if (!votacion) {
      return NextResponse.json({ ok: false, error: "VOTACION_INVALIDA" }, { status: 400 })
    }

    const { data: asamblea } = await supabaseAdmin
      .from("asambleas")
      .select("estado")
      .eq("id", votacion.asamblea_id)
      .maybeSingle()

    if (asamblea?.estado === "receso") {
      return NextResponse.json({ ok: false, error: "ASAMBLEA_RECESO" }, { status: 400 })
    }

    if ((votacion.ronda_numero || 1) !== 1) {
      return NextResponse.json({ ok: false, error: "NOMINACION_CERRADA" }, { status: 400 })
    }

    const { count: votosEmitidos } = await supabaseAdmin
      .from("votos")
      .select("*", { count: "exact", head: true })
      .eq("votacion_id", votacionId)

    if ((votosEmitidos || 0) > 0) {
      const { data: votoExistente } = await supabaseAdmin
        .from("votos")
        .select("id")
        .eq("votacion_id", votacionId)
        .eq("asambleista_id", tokenRow.asambleista_id)
        .maybeSingle()

      if (votoExistente) {
        return NextResponse.json({ ok: false, error: "YA_VOTO" }, { status: 400 })
      }
    }

    const { data: candidatoExistente } = await supabaseAdmin
      .from("candidatos")
      .select("id, nombre")
      .eq("votacion_id", votacionId)
      .ilike("nombre", nombreLimpio)
      .maybeSingle()

    let candidato = candidatoExistente

    if (!candidato) {
      const { data: candidatoCreado, error } = await supabaseAdmin
        .from("candidatos")
        .insert({
          votacion_id: votacionId,
          nombre: nombreLimpio,
        })
        .select("id, nombre")
        .single()

      if (error || !candidatoCreado) {
        return NextResponse.json(
          { ok: false, error: error?.message || "ERROR_NOMINACION" },
          { status: 500 }
        )
      }

      candidato = candidatoCreado
    }

    const { data: resultadoVoto, error: errorVoto } = await supabaseAdmin.rpc("registrar_voto", {
      p_token: token,
      p_votacion_id: votacionId,
      p_opcion: null,
      p_candidato_id: candidato.id,
      p_device_id: String(deviceId).trim(),
      p_ip: ip,
      p_user_agent: userAgent,
    })

    if (errorVoto) {
      return NextResponse.json(
        { ok: false, error: errorVoto.message },
        { status: 500 }
      )
    }

    if (resultadoVoto !== "OK") {
      return NextResponse.json(
        { ok: false, error: resultadoVoto },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true, candidato, duplicado: Boolean(candidatoExistente) })
  } catch {
    return NextResponse.json({ ok: false, error: "ERROR_SERVIDOR" }, { status: 500 })
  }
}
