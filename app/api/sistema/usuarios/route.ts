import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { crearPasswordSeguro } from "@/lib/auth"

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

export async function GET(req: NextRequest) {
  if (!esOwner(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from("usuarios_sistema")
    .select("id, nombre, username, roles, activo, organizacion_id")
    .order("nombre", { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, usuarios: data || [] })
}

export async function POST(req: NextRequest) {
  if (!esOwner(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { organizacionId, nombre, username, password } = await req.json()
  const nombreLimpio = String(nombre || "").trim()
  const usernameLimpio = String(username || "").trim().toLowerCase()
  const passwordLimpio = String(password || "")

  if (!organizacionId || !nombreLimpio || !usernameLimpio || passwordLimpio.length < 8) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const { salt, hash } = crearPasswordSeguro(passwordLimpio)
  const supabaseAdmin = crearSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from("usuarios_sistema")
    .insert({
      nombre: nombreLimpio,
      username: usernameLimpio,
      password_salt: salt,
      password_hash: hash,
      roles: ["admin"],
      activo: true,
      organizacion_id: organizacionId,
    })
    .select("id, nombre, username, roles, activo, organizacion_id")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message || "ERROR_CREAR_USUARIO" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, usuario: data })
}

export async function PATCH(req: NextRequest) {
  if (!esOwner(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { id, password, activo } = await req.json()

  if (!id) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const cambios: Record<string, string | boolean> = {
    actualizado_en: new Date().toISOString(),
  }

  if (typeof activo === "boolean") {
    cambios.activo = activo
  }

  if (typeof password === "string" && password.trim()) {
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: "PASSWORD_CORTO" }, { status: 400 })
    }

    const { salt, hash } = crearPasswordSeguro(password)
    cambios.password_salt = salt
    cambios.password_hash = hash
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from("usuarios_sistema")
    .update(cambios)
    .eq("id", id)
    .select("id, nombre, username, roles, activo, organizacion_id")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message || "ERROR_ACTUALIZAR_USUARIO" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, usuario: data })
}

