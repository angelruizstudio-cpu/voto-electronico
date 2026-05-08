import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

type CambiosAsambleista = {
  registrado?: boolean
  pago_confirmado?: boolean
  habilitado?: boolean
  presente?: boolean
}

function validarSesion(req: NextRequest) {
  return req.cookies.get("moderador_session")?.value === "true"
}

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function generarIniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/)
  const inicialNombre = partes[0]?.charAt(0).toUpperCase() || "X"
  const inicialApellido = partes[1]?.charAt(0).toUpperCase() || "X"

  return `${inicialNombre}${inicialApellido}`
}

export async function GET(req: NextRequest) {
  if (!validarSesion(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const supabaseAdmin = crearSupabaseAdmin()

  const { data: asambleaActiva, error: errorAsamblea } = await supabaseAdmin
    .from("asambleas")
    .select("id")
    .eq("estado", "abierta")
    .maybeSingle()

  if (errorAsamblea) {
    return NextResponse.json({ ok: false, error: errorAsamblea.message }, { status: 500 })
  }

  if (!asambleaActiva) {
    return NextResponse.json({ ok: true, asambleistas: [] })
  }

  const { data, error } = await supabaseAdmin
    .from("asambleistas")
    .select("*")
    .eq("asamblea_id", asambleaActiva.id)
    .order("nombre", { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, asambleistas: data || [] })
}

export async function POST(req: NextRequest) {
  if (!validarSesion(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { asambleaId, nombre, iglesia, distrito } = await req.json()
  const nombreLimpio = String(nombre || "").trim()

  if (!asambleaId || !nombreLimpio) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const anio = new Date().getFullYear().toString().slice(-2)

  const { count, error: errorCount } = await supabaseAdmin
    .from("asambleistas")
    .select("*", { count: "exact", head: true })
    .eq("asamblea_id", asambleaId)

  if (errorCount) {
    return NextResponse.json({ ok: false, error: errorCount.message }, { status: 500 })
  }

  const secuencia = String((count || 0) + 1).padStart(2, "0")
  const credencial = `${generarIniciales(nombreLimpio)}${anio}-${secuencia}`

  const { data, error } = await supabaseAdmin
    .from("asambleistas")
    .insert({
      asamblea_id: asambleaId,
      nombre: nombreLimpio,
      credencial,
      iglesia: String(iglesia || "").trim(),
      distrito: String(distrito || "").trim(),
      registrado: false,
      pago_confirmado: false,
      habilitado: false,
      presente: false,
    })
    .select("*")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message || "ERROR_CREAR_ASAMBLEISTA" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, asambleista: data })
}

export async function PATCH(req: NextRequest) {
  if (!validarSesion(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { id, cambios } = await req.json()

  if (!id || !cambios || typeof cambios !== "object") {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const cambiosPermitidos: CambiosAsambleista = {}

  for (const campo of ["registrado", "pago_confirmado", "habilitado", "presente"] as const) {
    if (typeof cambios[campo] === "boolean") {
      cambiosPermitidos[campo] = cambios[campo]
    }
  }

  if (Object.keys(cambiosPermitidos).length === 0) {
    return NextResponse.json({ ok: false, error: "SIN_CAMBIOS_VALIDOS" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()

  if (cambiosPermitidos.habilitado === true) {
    const { data: asambleistaActual, error: errorActual } = await supabaseAdmin
      .from("asambleistas")
      .select("registrado, pago_confirmado")
      .eq("id", id)
      .single()

    if (errorActual || !asambleistaActual) {
      return NextResponse.json({ ok: false, error: "NO_EXISTE" }, { status: 404 })
    }

    if (!asambleistaActual.registrado || !asambleistaActual.pago_confirmado) {
      return NextResponse.json(
        { ok: false, error: "REGISTRO_Y_PAGO_REQUERIDOS" },
        { status: 400 }
      )
    }
  }

  const cambiosParaGuardar: Record<string, boolean | string> = { ...cambiosPermitidos }

  if (cambiosPermitidos.habilitado === true) {
    cambiosParaGuardar.habilitado_en = new Date().toISOString()
  }

  if (cambiosPermitidos.presente === false) {
    cambiosParaGuardar.check_out_en = new Date().toISOString()
  }

  if (cambiosPermitidos.presente === true) {
    cambiosParaGuardar.checkin_en = new Date().toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from("asambleistas")
    .update(cambiosParaGuardar)
    .eq("id", id)
    .select("*")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message || "ERROR_ACTUALIZAR_ASAMBLEISTA" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, asambleista: data })
}
