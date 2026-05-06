import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
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