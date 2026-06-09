import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { obtenerTenantSesion } from "@/lib/tenant"

const TIPOS_INFORME = [
  "presidente",
  "secretario",
  "tesorero",
  "misiones",
  "otros",
] as const

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function validarSesion(req: NextRequest) {
  return (
    req.cookies.get("auth_session")?.value === "true" ||
    req.cookies.get("moderador_session")?.value === "true"
  )
}

async function obtenerAsambleaActiva(req: NextRequest) {
  const supabaseAdmin = crearSupabaseAdmin()
  const tenant = obtenerTenantSesion(req)
  let query = supabaseAdmin
    .from("asambleas")
    .select("id, organizacion_id, organizacion_slug")
    .in("estado", ["abierta", "receso"])

  if (tenant.id) {
    query = query.eq("organizacion_id", tenant.id)
  } else {
    query = query.eq("organizacion_slug", tenant.slug)
  }

  const { data, error } = await query.maybeSingle()

  if (error || !data) {
    return null
  }

  return data
}

export async function GET(req: NextRequest) {
  if (!validarSesion(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const asamblea = await obtenerAsambleaActiva(req)

  if (!asamblea) {
    return NextResponse.json({ ok: true, informes: [] })
  }

  const { data, error } = await supabaseAdmin
    .from("asamblea_informes")
    .select("*")
    .eq("asamblea_id", asamblea.id)
    .order("creado_en", { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const informes = await Promise.all(
    (data || []).map(async (informe) => {
      const { data: firmado } = await supabaseAdmin.storage
        .from(informe.storage_bucket)
        .createSignedUrl(informe.storage_path, 60 * 60)

      return {
        ...informe,
        url: firmado?.signedUrl || null,
      }
    })
  )

  return NextResponse.json({ ok: true, informes })
}

export async function POST(req: NextRequest) {
  if (!validarSesion(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const tenant = obtenerTenantSesion(req)
  const asamblea = await obtenerAsambleaActiva(req)

  if (!asamblea) {
    return NextResponse.json({ ok: false, error: "NO_HAY_ASAMBLEA" }, { status: 400 })
  }

  const formData = await req.formData()
  const tipo = String(formData.get("tipo") || "").trim().toLowerCase()
  const file = formData.get("archivo")

  if (!TIPOS_INFORME.includes(tipo as (typeof TIPOS_INFORME)[number])) {
    return NextResponse.json({ ok: false, error: "TIPO_INVALIDO" }, { status: 400 })
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "ARCHIVO_REQUERIDO" }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "bin"
  const nombreSeguro = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120)
  const ruta = `${tenant.slug}/${asamblea.id}/${tipo}-${Date.now()}.${extension}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from("informes-asamblea")
    .upload(ruta, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from("asamblea_informes")
    .insert({
      organizacion_id: asamblea.organizacion_id,
      organizacion_slug: asamblea.organizacion_slug,
      asamblea_id: asamblea.id,
      tipo,
      nombre_archivo: nombreSeguro,
      storage_bucket: "informes-asamblea",
      storage_path: ruta,
      mime_type: file.type || null,
      tamano_bytes: file.size,
      subido_por: req.cookies.get("auth_name")?.value || "Usuario",
    })
    .select("*")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message || "ERROR_GUARDAR_INFORME" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, informe: data })
}
