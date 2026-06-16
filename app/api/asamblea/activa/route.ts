import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  limpiarCodigoAccesoOrganizacion,
  limpiarSlugOrganizacion,
  obtenerTenantSesion,
} from "@/lib/tenant"

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const org = searchParams.get("org")
  const supabaseAdmin = crearSupabaseAdmin()
  const tenant = obtenerTenantSesion(req)
  const tenantAutenticado = Boolean(
    req.cookies.get("auth_org_id")?.value || req.cookies.get("auth_org_slug")?.value
  )
  const orgSlug = limpiarSlugOrganizacion(org)
  const orgCode = limpiarCodigoAccesoOrganizacion(org)
  let organizacionId = tenant.id
  let organizacionSlug = tenant.slug

  if (org && !tenantAutenticado) {
    const { data: organizacion, error: errorOrganizacion } = await supabaseAdmin
      .from("organizaciones")
      .select("id, nombre, slug, codigo_acceso")
      .or(`slug.eq.${orgSlug},codigo_acceso.eq.${orgCode}`)
      .eq("activa", true)
      .maybeSingle()

    if (errorOrganizacion) {
      return NextResponse.json({ ok: false, error: errorOrganizacion.message }, { status: 500 })
    }

    if (!organizacion) {
      return NextResponse.json({ ok: true, asamblea: null })
    }

    organizacionId = organizacion.id
    organizacionSlug = organizacion.slug
  }

  let queryAsamblea = supabaseAdmin
    .from("asambleas")
    .select("*")
    .in("estado", ["preparacion", "abierta", "receso"])

  if (organizacionId) {
    queryAsamblea = queryAsamblea.eq("organizacion_id", organizacionId)
  } else {
    queryAsamblea = queryAsamblea.eq("organizacion_slug", organizacionSlug)
  }

  const { data: asamblea, error: errorAsamblea } = await queryAsamblea
    .order("creada_en", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (errorAsamblea) {
    return NextResponse.json({ ok: false, error: errorAsamblea.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, asamblea: asamblea || null })
}
