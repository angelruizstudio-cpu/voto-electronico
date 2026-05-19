import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

type CambiosAsambleista = {
  registrado?: boolean
  pago_confirmado?: boolean
  habilitado?: boolean
  presente?: boolean
  metodo_voto?: "electronico" | "manual"
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

function limpiarTelefono(telefono: unknown) {
  const telefonoLimpio = String(telefono || "").trim()

  if (!telefonoLimpio) {
    return ""
  }

  if (/^\+[1-9]\d{7,14}$/.test(telefonoLimpio)) {
    return telefonoLimpio
  }

  const digitos = telefonoLimpio.replace(/\D/g, "")

  if (digitos.length === 10) {
    return `+1${digitos}`
  }

  if (digitos.length === 11 && digitos.startsWith("1")) {
    return `+${digitos}`
  }

  return ""
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

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function obtenerLinkVotacion() {
  const baseUrl =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  const baseUrlLimpio = baseUrl.trim().replace(/\/+$/, "")

  return baseUrlLimpio ? `${baseUrlLimpio}/asambleista` : "/asambleista"
}

async function obtenerErrorResend(res: Response) {
  const contentType = res.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null)
    const mensaje =
      data?.message ||
      data?.error ||
      data?.name ||
      `RESEND_HTTP_${res.status}`

    return String(mensaje).slice(0, 300)
  }

  await res.text().catch(() => "")

  if (res.status >= 500) {
    return `RESEND_TEMPORAL_${res.status}`
  }

  return `RESEND_HTTP_${res.status}`
}

async function enviarCredencialPorEmail({
  email,
  nombre,
  credencial,
  metodoVoto,
}: {
  email: string
  nombre: string
  credencial: string
  metodoVoto: "electronico" | "manual"
}): Promise<ResultadoEnvioCredencial> {
  if (!email) {
    return { enviado: false }
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || "Asamblea <onboarding@resend.dev>"
  const nombreHtml = escaparHtml(nombre)
  const credencialHtml = escaparHtml(credencial)
  const esManual = metodoVoto === "manual"
  const qrPayload = `VOTOAPP:${credencial}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=18&data=${encodeURIComponent(qrPayload)}`

  if (!apiKey) {
    return { enviado: false, error: "FALTA_RESEND_API_KEY" }
  }

  const payload = {
    from,
    to: [email],
    subject: esManual ? "Credencial de identificación de asamblea" : "Credencial de asamblea",
    text: esManual
      ? `Saludos ${nombre},\n\nSu credencial de identificación para check-in/check-out en la asamblea es: ${credencial}\n\nPresente esta credencial o el codigo QR en la puerta. Su voto será emitido por balota manual según el proceso de la asamblea.\n`
      : `Saludos ${nombre},\n\nSu credencial para hacer check-in en la asamblea es: ${credencial}\n\nPresente esta credencial o el codigo QR en la puerta para agilizar su check-in/check-out. El token de votacion se genera aparte durante el check-in.\n`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <h1 style="font-size: 22px;">${esManual ? "Credencial de identificación de asamblea" : "Credencial de asamblea"}</h1>
        <p>Saludos ${nombreHtml},</p>
        <p>Su credencial ${esManual ? "de identificación para check-in/check-out" : "para hacer check-in en la asamblea"} es:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.08em;">${credencialHtml}</p>
        <div style="margin: 18px 0; display: inline-block; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background: #ffffff;">
          <img src="${qrUrl}" width="220" height="220" alt="Codigo QR de credencial ${credencialHtml}" style="display: block;" />
        </div>
        <p>Presente esta credencial o el código QR en la puerta para agilizar su check-in/check-out.</p>
        <p style="color: #475569; font-size: 14px;">${esManual ? "Su voto será emitido por balota manual según el proceso de la asamblea." : "El token de votación se genera aparte durante el check-in."}</p>
      </div>
    `,
  }

  for (let intento = 1; intento <= 2; intento += 1) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      return { enviado: true }
    }

    const error = await obtenerErrorResend(res)

    if (res.status < 500 || intento === 2) {
      return { enviado: false, error }
    }

    await esperar(900)
  }

  return { enviado: false, error: "ERROR_RESEND" }
}

async function obtenerErrorSent(res: Response) {
  const contentType = res.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null)
    const mensaje =
      data?.error?.message ||
      data?.error?.code ||
      data?.message ||
      data?.code ||
      `SENT_HTTP_${res.status}`

    return String(mensaje).slice(0, 300)
  }

  await res.text().catch(() => "")

  if (res.status >= 500) {
    return `SENT_TEMPORAL_${res.status}`
  }

  return `SENT_HTTP_${res.status}`
}

async function enviarCredencialPorSms({
  telefono,
  nombre,
  credencial,
  metodoVoto,
}: {
  telefono: string
  nombre: string
  credencial: string
  metodoVoto: "electronico" | "manual"
}): Promise<ResultadoEnvioCredencial> {
  if (!telefono) {
    return { enviado: false }
  }

  const apiKey = process.env.SENT_API_KEY || process.env.SENT_DM_API_KEY
  const templateId = process.env.SENT_TEMPLATE_ID || process.env.SENT_DM_TEMPLATE_ID
  const sandbox = process.env.SENT_SANDBOX === "true"
  const linkVotacion = obtenerLinkVotacion()

  if (!apiKey || !templateId) {
    return { enviado: false, error: "FALTA_SENT_CONFIG" }
  }

  const payload = {
    to: [telefono],
    channel: ["sms"],
    template: {
      id: templateId,
      parameters: {
        nombre,
        credencial,
        linkVotacion,
        metodoVoto: metodoVoto === "manual" ? "manual" : "electronico",
      },
    },
    sandbox,
  }

  for (let intento = 1; intento <= 2; intento += 1) {
    const res = await fetch("https://api.sent.dm/v3/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (res.status === 202 || res.ok) {
      return { enviado: true }
    }

    const error = await obtenerErrorSent(res)

    if (res.status < 500 || intento === 2) {
      return { enviado: false, error }
    }

    await esperar(900)
  }

  return { enviado: false, error: "ERROR_SENT" }
}

export async function GET(req: NextRequest) {
  if (!validarSesion(req)) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const supabaseAdmin = crearSupabaseAdmin()

  const { data: asambleaActiva, error: errorAsamblea } = await supabaseAdmin
    .from("asambleas")
    .select("id")
    .in("estado", ["abierta", "receso"])
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

  const { asambleaId, nombre, iglesia, distrito, email, telefono, metodoVoto } = await req.json()
  const nombreLimpio = String(nombre || "").trim()
  const emailLimpio = limpiarEmail(email)
  const telefonoLimpio = limpiarTelefono(telefono)
  const metodoVotoLimpio = metodoVoto === "manual" ? "manual" : "electronico"

  if (!asambleaId || !nombreLimpio) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  if (email && !emailLimpio) {
    return NextResponse.json({ ok: false, error: "EMAIL_INVALIDO" }, { status: 400 })
  }

  if (telefono && !telefonoLimpio) {
    return NextResponse.json({ ok: false, error: "TELEFONO_INVALIDO" }, { status: 400 })
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
      telefono: telefonoLimpio || null,
      metodo_voto: metodoVotoLimpio,
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
    metodoVoto: metodoVotoLimpio,
  })
  const resultadoSms = await enviarCredencialPorSms({
    telefono: telefonoLimpio,
    nombre: nombreLimpio,
    credencial,
    metodoVoto: metodoVotoLimpio,
  })

  let asambleista = data

  if (emailLimpio || telefonoLimpio) {
    const { data: actualizado } = await supabaseAdmin
      .from("asambleistas")
      .update({
        credencial_email_enviado_en: resultadoEmail.enviado
          ? new Date().toISOString()
          : null,
        credencial_email_error: resultadoEmail.error || null,
        credencial_sms_enviado_en: resultadoSms.enviado
          ? new Date().toISOString()
          : null,
        credencial_sms_error: resultadoSms.error || null,
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
    credencialSms: resultadoSms,
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

  if (cambios.metodo_voto === "electronico" || cambios.metodo_voto === "manual") {
    cambiosPermitidos.metodo_voto = cambios.metodo_voto
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
