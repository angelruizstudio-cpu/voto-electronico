import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"



export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { credencial } = await req.json()

    if (!credencial) {
      return NextResponse.json({ ok: false, error: "FALTA_CREDENCIAL" }, { status: 400 })
    }

    const credencialNormalizada = String(credencial).trim().toUpperCase()

    const { data: asamblea } = await supabaseAdmin
      .from("asambleas")
      .select("id")
      .in("estado", ["abierta", "receso"])
      .single()

    if (!asamblea) {
      return NextResponse.json({ ok: false, error: "NO_HAY_ASAMBLEA" }, { status: 400 })
    }

    const { data: asambleista } = await supabaseAdmin
      .from("asambleistas")
      .select("id, nombre, habilitado, metodo_voto")
      .eq("asamblea_id", asamblea.id)
      .eq("credencial", credencialNormalizada)
      .single()
    if (!asambleista) {
      return NextResponse.json(
        { ok: false, error: "NO_EXISTE" },
        { status: 404 }
      )
    }

    if (!asambleista.habilitado) {
      return NextResponse.json(
        {
          ok: false,
          error: "NO_HABILITADO",
        },
        { status: 403 }
      )
    }

    if (asambleista.metodo_voto === "manual") {
      return NextResponse.json(
        {
          ok: false,
          error: "VOTO_MANUAL",
        },
        { status: 403 }
      )
    }
    await supabaseAdmin
      .from("asambleistas")
      .update({
        presente: true,
        checkin_en: new Date().toISOString(),
      })
      .eq("id", asambleista.id)

    const token = crypto.randomUUID().replace(/-/g, "")

    const { data: tokenGuardado, error } = await supabaseAdmin
      .from("tokens_acceso")
      .upsert(
        {
          asamblea_id: asamblea.id,
          asambleista_id: asambleista.id,
          token_hash: token,
          activo: true,
          bloqueado: false,
          expira_en: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          onConflict: "asamblea_id,asambleista_id",
        }
      )
      .select("token_hash")
      .single()

    if (error || !tokenGuardado) {
      return NextResponse.json(
        { ok: false, error: error?.message || "ERROR_TOKEN" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      token: tokenGuardado.token_hash,
      asambleista: {
        nombre: asambleista.nombre,
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: "ERROR_SERVIDOR" }, { status: 500 })
  }
}
