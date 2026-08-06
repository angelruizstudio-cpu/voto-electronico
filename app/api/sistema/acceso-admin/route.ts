import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

function esOwner(req: NextRequest) {
  return (
    req.cookies.get("auth_session")?.value === "true" &&
    req.cookies.get("auth_role")?.value === "owner"
  )
}

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  if (!esOwner(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { organizacionId } = await req.json()

  if (!organizacionId) {
    return NextResponse.json({ ok: false, error: "FALTA_ORGANIZACION" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const { data: organizacion, error } = await supabaseAdmin
    .from("organizaciones")
    .select("id, nombre, slug, codigo_acceso")
    .eq("id", organizacionId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  if (!organizacion) {
    return NextResponse.json({ ok: false, error: "ORGANIZACION_INVALIDA" }, { status: 404 })
  }

  const response = NextResponse.json({ ok: true })
  const opciones = {
    path: "/",
    maxAge: 43200,
    httpOnly: true,
    sameSite: "strict" as const,
  }

  response.cookies.set("auth_roles", JSON.stringify(["owner", "admin"]), opciones)
  response.cookies.set("auth_org_id", organizacion.id, opciones)
  response.cookies.set("auth_org_name", organizacion.nombre, opciones)
  response.cookies.set("auth_org_slug", organizacion.slug, opciones)
  response.cookies.set("auth_org_code", organizacion.codigo_acceso || organizacion.slug, opciones)
  response.cookies.set("moderador_session", "true", opciones)

  return response
}
