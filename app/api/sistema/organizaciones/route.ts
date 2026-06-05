import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { crearPasswordSeguro } from "@/lib/auth"
import {
  limpiarCodigoAccesoOrganizacion,
  limpiarSlugOrganizacion,
  sugerirCodigoAccesoOrganizacion,
} from "@/lib/tenant"

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
    .from("organizaciones")
    .select("id, nombre, slug, codigo_acceso, activa, creado_en")
    .order("nombre", { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, organizaciones: data || [] })
}

export async function POST(req: NextRequest) {
  if (!esOwner(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { nombre, slug, codigoAcceso, adminNombre, adminUsername, adminPassword } = await req.json()
  const nombreLimpio = String(nombre || "").trim()
  const slugLimpio = limpiarSlugOrganizacion(slug || nombre)
  const codigoAccesoLimpio =
    limpiarCodigoAccesoOrganizacion(codigoAcceso) ||
    sugerirCodigoAccesoOrganizacion(nombreLimpio)
  const adminNombreLimpio = String(adminNombre || "").trim()
  const adminUsernameLimpio = String(adminUsername || "").trim().toLowerCase()
  const adminPasswordLimpio = String(adminPassword || "")

  if (
    !nombreLimpio ||
    !slugLimpio ||
    !codigoAccesoLimpio ||
    !adminNombreLimpio ||
    !adminUsernameLimpio ||
    adminPasswordLimpio.length < 8
  ) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const { data: organizacion, error: errorOrganizacion } = await supabaseAdmin
    .from("organizaciones")
    .insert({
      nombre: nombreLimpio,
      slug: slugLimpio,
      codigo_acceso: codigoAccesoLimpio,
      activa: true,
    })
    .select("id, nombre, slug, codigo_acceso, activa, creado_en")
    .single()

  if (errorOrganizacion || !organizacion) {
    return NextResponse.json(
      { ok: false, error: errorOrganizacion?.message || "ERROR_CREAR_ORGANIZACION" },
      { status: 500 }
    )
  }

  const { salt, hash } = crearPasswordSeguro(adminPasswordLimpio)
  const { error: errorUsuario } = await supabaseAdmin.from("usuarios_sistema").insert({
    nombre: adminNombreLimpio,
    username: adminUsernameLimpio,
    password_salt: salt,
    password_hash: hash,
    roles: ["admin"],
    activo: true,
    organizacion_id: organizacion.id,
  })

  if (errorUsuario) {
    await supabaseAdmin.from("organizaciones").delete().eq("id", organizacion.id)

    return NextResponse.json(
      { ok: false, error: errorUsuario.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, organizacion })
}

export async function PATCH(req: NextRequest) {
  if (!esOwner(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { id, activa } = await req.json()

  if (!id || typeof activa !== "boolean") {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from("organizaciones")
    .update({
      activa,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, nombre, slug, codigo_acceso, activa, creado_en")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message || "ERROR_ACTUALIZAR_ORGANIZACION" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, organizacion: data })
}
