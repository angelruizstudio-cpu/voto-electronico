import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { crearPasswordSeguro, ROLES_SISTEMA } from "@/lib/auth"
import { obtenerOrganizacionId } from "@/lib/tenant"

const ROLES_CLIENTE = ROLES_SISTEMA.filter((rol) => rol !== "owner")

function esAdmin(req: NextRequest) {
  return (
    req.cookies.get("auth_session")?.value === "true" &&
    req.cookies.get("auth_role")?.value === "admin"
  )
}

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  if (!esAdmin(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const organizacionId = obtenerOrganizacionId(req)
  let query = supabaseAdmin
    .from("usuarios_sistema")
    .select("id, nombre, username, roles, activo, creado_en, organizacion_id")
    .order("nombre", { ascending: true })

  if (organizacionId) {
    query = query.eq("organizacion_id", organizacionId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, usuarios: data || [] })
}

export async function POST(req: NextRequest) {
  if (!esAdmin(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { nombre, username, password, roles } = await req.json()
  const rolesValidos = Array.isArray(roles)
    ? roles.filter((rol) => ROLES_CLIENTE.includes(rol))
    : []

  if (!nombre || !username || !password || rolesValidos.length === 0) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const { salt, hash } = crearPasswordSeguro(String(password))
  const supabaseAdmin = crearSupabaseAdmin()
  const organizacionId = obtenerOrganizacionId(req)

  if (!organizacionId) {
    return NextResponse.json({ ok: false, error: "FALTA_ORGANIZACION" }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from("usuarios_sistema")
    .insert({
      nombre: String(nombre).trim(),
      username: String(username).trim().toLowerCase(),
      password_salt: salt,
      password_hash: hash,
      roles: rolesValidos,
      activo: true,
      organizacion_id: organizacionId,
    })
    .select("id, nombre, username, roles, activo, creado_en, organizacion_id")
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
  if (!esAdmin(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { id, nombre, password, roles, activo } = await req.json()

  if (!id) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const cambios: Record<string, string | string[] | boolean> = {
    actualizado_en: new Date().toISOString(),
  }

  if (typeof nombre === "string" && nombre.trim()) {
    cambios.nombre = nombre.trim()
  }

  if (Array.isArray(roles)) {
    cambios.roles = roles.filter((rol) => ROLES_CLIENTE.includes(rol))
  }

  if (typeof activo === "boolean") {
    cambios.activo = activo
  }

  if (typeof password === "string" && password.trim()) {
    const { salt, hash } = crearPasswordSeguro(password)
    cambios.password_salt = salt
    cambios.password_hash = hash
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const organizacionId = obtenerOrganizacionId(req)
  let query = supabaseAdmin
    .from("usuarios_sistema")
    .update(cambios)
    .eq("id", id)
    .select("id, nombre, username, roles, activo, creado_en, organizacion_id")

  if (organizacionId) {
    query = query.eq("organizacion_id", organizacionId)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message || "ERROR_ACTUALIZAR_USUARIO" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, usuario: data })
}
