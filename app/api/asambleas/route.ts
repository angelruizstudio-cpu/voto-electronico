import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { obtenerTenantSesion } from "@/lib/tenant"

function validarSesion(req: NextRequest) {
  return (
    req.cookies.get("auth_session")?.value === "true" ||
    req.cookies.get("moderador_session")?.value === "true"
  )
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

  const tenant = obtenerTenantSesion(req)
  const supabaseAdmin = crearSupabaseAdmin()
  const { organizacion, anio, lugar } = await req.json()

  const organizacionLimpia = String(organizacion || "").trim()
  const lugarLimpio = String(lugar || "").trim()
  const anioNumero = Number(anio)

  if (!organizacionLimpia || !lugarLimpio || !Number.isFinite(anioNumero)) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  let buscarActiva = supabaseAdmin
    .from("asambleas")
    .select("id, organizacion, anio, lugar, estado")
    .in("estado", ["abierta", "receso"])

  if (tenant.id) {
    buscarActiva = buscarActiva.eq("organizacion_id", tenant.id)
  } else {
    buscarActiva = buscarActiva.eq("organizacion_slug", tenant.slug)
  }

  const { data: activa, error: errorActiva } = await buscarActiva.limit(1).maybeSingle()

  if (errorActiva) {
    return NextResponse.json({ ok: false, error: errorActiva.message }, { status: 500 })
  }

  if (activa) {
    return NextResponse.json(
      {
        ok: false,
        error: "ASAMBLEA_ACTIVA_EXISTE",
        asamblea: activa,
      },
      { status: 409 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from("asambleas")
    .insert({
      organizacion_id: tenant.id,
      organizacion_slug: tenant.slug,
      organizacion: organizacionLimpia,
      anio: anioNumero,
      lugar: lugarLimpio,
      estado: "abierta",
    })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "ASAMBLEA_ACTIVA_EXISTE" },
        { status: 409 }
      )
    }

    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, asamblea: data })
}
