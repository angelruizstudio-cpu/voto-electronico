import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"


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

    const { data: tokenRow } = await supabaseAdmin
      .from("tokens_acceso")
      .select("asambleista_id, asambleistas(dispositivo_autorizado_id, dispositivo_alerta_en)")
      .eq("token_hash", token)
      .eq("activo", true)
      .eq("bloqueado", false)
      .maybeSingle()

    const asambleistaToken = Array.isArray(tokenRow?.asambleistas)
      ? tokenRow?.asambleistas[0]
      : tokenRow?.asambleistas

    if (asambleistaToken?.dispositivo_alerta_en) {
      return NextResponse.json(
        { ok: false, code: "DISPOSITIVO_REVALIDACION_REQUERIDA" },
        { status: 403 }
      )
    }

    if (
      asambleistaToken?.dispositivo_autorizado_id &&
      asambleistaToken.dispositivo_autorizado_id !== deviceId
    ) {
      return NextResponse.json(
        { ok: false, code: "DISPOSITIVO_REVALIDACION_REQUERIDA" },
        { status: 403 }
      )
    }
   
    const { data, error } = await supabaseAdmin.rpc("registrar_voto", {
      p_token: token,
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
