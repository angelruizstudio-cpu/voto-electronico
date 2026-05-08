import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

type CambiosAsambleista = {
  registrado?: boolean
  pago_confirmado?: boolean
  habilitado?: boolean
  presente?: boolean
}

type ResultadoEnvioCredencial = {
  enviado: boolean
  error?: string
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

function limpiarEmail(email: unknown) {
  const emailLimpio = String(email || "").trim().toLowerCase()

  if (!emailLimpio) {
    return ""
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio) ? emailLimpio : ""
}

function escaparHtml(valor: string) {
  return valor.replace(/[&<>"']/g, (caracter) => {
    const reemplazos: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }

    return reemplazos[caracter]
  })
}

async function enviarCredencialPorEmail({
  email,
  nombre,
  credencial,
}: {
  email: string
  nombre: string
  credencial: string
}): Promise<ResultadoEnvioCredencial> {
  if (!email) {
    return { enviado: false }
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || "Asamblea <onboarding@resend.dev>"
  const nombreHtml = escaparHtml(nombre)
  const credencialHtml = escaparHtml(credencial)

  if (!apiKey) {
    return { enviado: false, error: "FALTA_RESEND_API_KEY" }
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Credencial de asamblea",
      text: `Saludos ${nombre},\n\nSu credencial para hacer check-in en la asamblea es: ${credencial}\n\nUse esta credencial al llegar a la asamblea. El token de votación se genera aparte durante el check-in.\n`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
          <h1 style="font-size: 22px;">Credencial de asamblea</h1>
          <p>Saludos ${nombreHtml},</p>
          <p>Su credencial para hacer check-in en la asamblea es:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.08em;">${credencialHtml}</p>
          <p>Use esta credencial al llegar a la asamblea.</p>
          <p style="color: #475569; font-size: 14px;">El token de votación se genera aparte durante el check-in.</p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const detalle = await res.text()
    return { enviado: false, error: detalle || "ERROR_RESEND" }
  }

  return { enviado: true }
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

  const { asambleaId, nombre, iglesia, distrito, email } = await req.json()
  const nombreLimpio = String(nombre || "").trim()
  const emailLimpio = limpiarEmail(email)

  if (!asambleaId || !nombreLimpio) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  if (email && !emailLimpio) {
    return NextResponse.json({ ok: false, error: "EMAIL_INVALIDO" }, { status: 400 })
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
      email: emailLimpio || null,
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

  const resultadoEmail = await enviarCredencialPorEmail({
    email: emailLimpio,
    nombre: nombreLimpio,
    credencial,
  })

  let asambleista = data

  if (emailLimpio) {
    const { data: actualizado } = await supabaseAdmin
      .from("asambleistas")
      .update({
        credencial_email_enviado_en: resultadoEmail.enviado
          ? new Date().toISOString()
          : null,
        credencial_email_error: resultadoEmail.error || null,
      })
      .eq("id", data.id)
      .select("*")
      .single()

    asambleista = actualizado || data
  }

  return NextResponse.json({
    ok: true,
    asambleista,
    credencialEmail: resultadoEmail,
  })
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
