import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { hashTokenVotacion } from "@/lib/tokenHash"


export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const body = await req.json()

    const { token, votacionId, opcion, candidatoId, deviceId } = body

    if (!token || !votacionId || !deviceId) {
      return NextResponse.json(
        { ok: false, error: "FALTAN_DATOS" },
        { status: 400 }
      )
    }

    const userAgent = req.headers.get("user-agent") || "unknown"
    const forwardedFor = req.headers.get("x-forwarded-for")
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown"

    const { data: votacion } = await supabaseAdmin
      .from("votaciones")
      .select("id, asamblea_id, estado")
      .eq("id", votacionId)
      .maybeSingle()

    if (!votacion || votacion.estado !== "abierta") {
      return NextResponse.json(
        { ok: false, code: "VOTACION_CERRADA" },
        { status: 400 }
      )
    }

    const { data: asamblea } = await supabaseAdmin
      .from("asambleas")
      .select("estado")
      .eq("id", votacion.asamblea_id)
      .maybeSingle()

    if (asamblea?.estado === "receso") {
      return NextResponse.json(
        { ok: false, code: "ASAMBLEA_RECESO" },
        { status: 400 }
      )
    }

    // Doble-lectura: acepta el token ya hasheado (nuevos) o en claro (tokens
    // legacy previos a este cambio), sin romper sesiones activas.
    const { data: tokenRow } = await supabaseAdmin
      .from("tokens_acceso")
      .select("token_hash, asamblea_id, asambleista_id")
      .in("token_hash", [hashTokenVotacion(token), token])
      .eq("activo", true)
      .eq("bloqueado", false)
      .maybeSingle()

    if (!tokenRow || tokenRow.asamblea_id !== votacion.asamblea_id) {
      return NextResponse.json(
        { ok: false, code: "TOKEN_INVALIDO" },
        { status: 401 }
      )
    }

    const { data: asambleista } = await supabaseAdmin
      .from("asambleistas")
      .select("habilitado, presente, metodo_voto, dispositivo_autorizado_id, dispositivo_alerta_en")
      .eq("id", tokenRow.asambleista_id)
      .eq("asamblea_id", votacion.asamblea_id)
      .maybeSingle()

    if (!asambleista) {
      return NextResponse.json(
        { ok: false, code: "ASAMBLEISTA_INVALIDO" },
        { status: 401 }
      )
    }

    if (!asambleista.habilitado) {
      return NextResponse.json(
        { ok: false, code: "NO_HABILITADO" },
        { status: 403 }
      )
    }

    if (!asambleista.presente) {
      return NextResponse.json(
        { ok: false, code: "NO_PRESENTE" },
        { status: 403 }
      )
    }

    if (asambleista.metodo_voto === "manual") {
      return NextResponse.json(
        { ok: false, code: "VOTO_MANUAL" },
        { status: 403 }
      )
    }

    if (
      asambleista.dispositivo_alerta_en ||
      (asambleista.dispositivo_autorizado_id &&
        asambleista.dispositivo_autorizado_id !== deviceId)
    ) {
      return NextResponse.json(
        { ok: false, code: "DISPOSITIVO_REVALIDACION_REQUERIDA" },
        { status: 403 }
      )
    }

    const { data, error } = await supabaseAdmin.rpc("registrar_voto", {
      p_token: tokenRow.token_hash,
      p_votacion_id: votacionId,
      p_opcion: opcion ?? null,
      p_candidato_id: candidatoId ?? null,
      p_device_id: deviceId,
      p_ip: ip,
      p_user_agent: userAgent,
    })

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    if (data !== "OK") {
      return NextResponse.json(
        { ok: false, code: data },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true, code: "OK" })
  } catch {
    return NextResponse.json(
      { ok: false, error: "ERROR_SERVIDOR" },
      { status: 500 }
    )
  }
}
