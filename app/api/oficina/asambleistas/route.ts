import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { obtenerTenantSesion } from "@/lib/tenant"

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
  messageId?: string
}

type SentMessageResponse = {
  success?: boolean
  data?: {
    recipients?: Array<{
      message_id?: string
      id?: string
    }>
    message_id?: string
    id?: string
  }
  error?: {
    message?: string
    code?: string
    details?: unknown
  }
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

async function registrarAuditoria(
  supabaseAdmin: ReturnType<typeof crearSupabaseAdmin>,
  req: NextRequest,
  {
    asambleaId,
    asambleistaId,
    accion,
    detalle,
  }: {
    asambleaId?: string | null
    asambleistaId?: string | null
    accion: string
    detalle?: string | null
  }
) {
  try {
    await supabaseAdmin
      .from("auditoria_operativa")
      .insert({
        asamblea_id: asambleaId || null,
        asambleista_id: asambleistaId || null,
        usuario_id: req.cookies.get("auth_user_id")?.value || null,
        usuario_nombre: req.cookies.get("auth_name")?.value || "Usuario",
        accion,
        detalle: detalle || null,
      })
  } catch {
    // La auditoría no debe bloquear la operación de registro el día de la asamblea.
  }
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

function formatearDetalleSent(details: unknown) {
  if (!details) {
    return ""
  }

  if (typeof details === "string") {
    return details
  }

  if (Array.isArray(details)) {
    return details.map((item) => String(item)).join("; ")
  }

  if (typeof details === "object") {
    return Object.entries(details)
      .map(([campo, valor]) => {
        if (Array.isArray(valor)) {
          return `${campo}: ${valor.map((item) => String(item)).join(", ")}`
        }

        return `${campo}: ${String(valor)}`
      })
      .join("; ")
  }

  return String(details)
}

function formatearErrorSent(error: SentMessageResponse["error"], status: number) {
  const mensaje = error?.message || error?.code || `SENT_HTTP_${status}`
  const detalles = formatearDetalleSent(error?.details)

  return detalles ? `${mensaje}: ${detalles}` : mensaje
}

function obtenerErrorSent(status: number, contentType: string, body: string) {
  const contentTypeLimpio = contentType || ""

  if (contentTypeLimpio.includes("application/json")) {
    const data = JSON.parse(body || "null")
    const mensaje = data?.error
      ? formatearErrorSent(data.error, status)
      : data?.message || data?.code || `SENT_HTTP_${status}`

    return String(mensaje).slice(0, 300)
  }

  if (status >= 500) {
    return `SENT_TEMPORAL_${status}`
  }

  return `SENT_HTTP_${status}`
}

function validarConfigSent() {
  const apiKey = process.env.SENT_API_KEY
  const senderId = process.env.SENT_SENDER_ID
  const templateId = process.env.SENT_TEMPLATE_ID

  console.log("Sent.dm SENT_SENDER_ID loaded", {
    loaded: Boolean(senderId),
    preview: senderId ? `${senderId.slice(0, 4)}...${senderId.slice(-4)}` : null,
  })

  if (!apiKey) {
    throw new Error("Missing required environment variable SENT_API_KEY")
  }

  if (!senderId) {
    throw new Error("Missing required environment variable SENT_SENDER_ID")
  }

  if (!templateId) {
    throw new Error("Missing required environment variable SENT_TEMPLATE_ID")
  }

  return {
    apiKey,
    senderId,
    templateId,
  }
}

async function enviarCredencialPorSms({
  telefono,
  nombre,
  credencial,
}: {
  telefono: string
  nombre: string
  credencial: string
}): Promise<ResultadoEnvioCredencial> {
  if (!telefono) {
    return { enviado: false }
  }

  const { apiKey, senderId, templateId } = validarConfigSent()
  const sandbox = process.env.SENT_SANDBOX === "true"

  const payload = {
    to: [telefono],
    channel: ["sms"],
    template: {
      id: templateId,
      parameters: {
        nombre,
        credencial,
        code: credencial,
        var_2: credencial,
      },
    },
    sandbox,
  }

  for (let intento = 1; intento <= 2; intento += 1) {
    const res = await fetch("https://api.sent.dm/v3/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "x-sender-id": senderId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const responseBody = await res.text().catch(() => "")
    let data: SentMessageResponse | null = null

    try {
      data = responseBody ? (JSON.parse(responseBody) as SentMessageResponse) : null
    } catch {
      data = null
    }

    if ((res.status === 202 || res.ok) && data?.success !== false) {
      const messageId =
        data?.data?.recipients?.[0]?.message_id ||
        data?.data?.recipients?.[0]?.id ||
        data?.data?.message_id ||
        data?.data?.id

      console.log("[Sent.dm] Mensaje enviado, message_id:", messageId || "no disponible")

      return { enviado: true, messageId }
    }

    console.error("[Sent.dm] Error enviando SMS:", {
      status: res.status,
      body: responseBody || data,
      request: {
        toCount: payload.to.length,
        toPreview: telefono ? `${telefono.slice(0, 3)}...${telefono.slice(-4)}` : null,
        channel: payload.channel,
        templateId: templateId ? `${templateId.slice(0, 8)}...${templateId.slice(-8)}` : null,
        parameterKeys: Object.keys(payload.template.parameters),
        sandbox,
      },
    })

    let error = `SENT_HTTP_${res.status}`
    try {
      error =
        formatearErrorSent(data?.error, res.status) ||
        obtenerErrorSent(res.status, res.headers.get("content-type") || "", responseBody)
    } catch {
      error = res.status >= 500 ? `SENT_TEMPORAL_${res.status}` : `SENT_HTTP_${res.status}`
    }

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
  const tenant = obtenerTenantSesion(req)

  let queryAsamblea = supabaseAdmin
    .from("asambleas")
    .select("id")
    .in("estado", ["preparacion", "abierta", "receso"])

  if (tenant.id) {
    queryAsamblea = queryAsamblea.eq("organizacion_id", tenant.id)
  } else {
    queryAsamblea = queryAsamblea.eq("organizacion_slug", tenant.slug)
  }

  const { data: asambleaActiva, error: errorAsamblea } = await queryAsamblea.maybeSingle()

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

  const {
    asambleaId,
    nombre,
    iglesia,
    distrito,
    email,
    telefono,
    metodoVoto,
    enviarCredenciales = true,
  } = await req.json()
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
  const tenant = obtenerTenantSesion(req)
  const anio = new Date().getFullYear().toString().slice(-2)

  let queryAsamblea = supabaseAdmin
    .from("asambleas")
    .select("id")
    .eq("id", asambleaId)

  if (tenant.id) {
    queryAsamblea = queryAsamblea.eq("organizacion_id", tenant.id)
  } else {
    queryAsamblea = queryAsamblea.eq("organizacion_slug", tenant.slug)
  }

  const { data: asambleaPermitida, error: errorAsambleaPermitida } =
    await queryAsamblea.maybeSingle()

  if (errorAsambleaPermitida) {
    return NextResponse.json({ ok: false, error: errorAsambleaPermitida.message }, { status: 500 })
  }

  if (!asambleaPermitida) {
    return NextResponse.json({ ok: false, error: "ASAMBLEA_NO_AUTORIZADA" }, { status: 403 })
  }

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
      registrado: enviarCredenciales !== false,
      pago_confirmado: enviarCredenciales !== false,
      habilitado: enviarCredenciales !== false,
      habilitado_en: enviarCredenciales !== false ? new Date().toISOString() : null,
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

  const resultadoEmail =
    enviarCredenciales === false
      ? { enviado: false }
      : await enviarCredencialPorEmail({
          email: emailLimpio,
          nombre: nombreLimpio,
          credencial,
          metodoVoto: metodoVotoLimpio,
        })
  const resultadoSms =
    enviarCredenciales === false
      ? { enviado: false }
      : await enviarCredencialPorSms({
          telefono: telefonoLimpio,
          nombre: nombreLimpio,
          credencial,
        })

  let asambleista = data

  if (emailLimpio || telefonoLimpio) {
    const { data: actualizado } = await supabaseAdmin
      .from("asambleistas")
      .update({
        registrado: true,
        pago_confirmado: true,
        habilitado: true,
        habilitado_en: new Date().toISOString(),
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

  await registrarAuditoria(supabaseAdmin, req, {
    asambleaId,
    asambleistaId: asambleista.id,
    accion: enviarCredenciales === false ? "pre_registro_asambleista" : "crear_y_activar_asambleista",
    detalle: `${nombreLimpio} (${credencial})`,
  })

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

  const { id, cambios, accion } = await req.json()

  if (!id || (!accion && (!cambios || typeof cambios !== "object"))) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const tenant = obtenerTenantSesion(req)

  const { data: asambleistaPermitido, error: errorAsambleistaPermitido } = await supabaseAdmin
    .from("asambleistas")
    .select("id, asamblea_id")
    .eq("id", id)
    .maybeSingle()

  if (errorAsambleistaPermitido) {
    return NextResponse.json(
      { ok: false, error: errorAsambleistaPermitido.message },
      { status: 500 }
    )
  }

  if (!asambleistaPermitido) {
    return NextResponse.json({ ok: false, error: "NO_EXISTE" }, { status: 404 })
  }

  let queryAsamblea = supabaseAdmin
    .from("asambleas")
    .select("id")
    .eq("id", asambleistaPermitido.asamblea_id)

  if (tenant.id) {
    queryAsamblea = queryAsamblea.eq("organizacion_id", tenant.id)
  } else {
    queryAsamblea = queryAsamblea.eq("organizacion_slug", tenant.slug)
  }

  const { data: asambleaPermitida } = await queryAsamblea.maybeSingle()

  if (!asambleaPermitida) {
    return NextResponse.json({ ok: false, error: "ASAMBLEISTA_NO_AUTORIZADO" }, { status: 403 })
  }

  if (accion === "reset_dispositivo") {
    const { data: asambleistaActual } = await supabaseAdmin
      .from("asambleistas")
      .select("id, asamblea_id, credencial, dispositivo_autorizado_id")
      .eq("id", id)
      .single()

    const { data, error } = await supabaseAdmin
      .from("asambleistas")
      .update({
        dispositivo_autorizado_id: null,
        dispositivo_autorizado_en: null,
        dispositivo_alerta_en: null,
        dispositivo_alerta_detalle: null,
      })
      .eq("id", id)
      .select("*")
      .single()

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message || "ERROR_RESET_DISPOSITIVO" },
        { status: 500 }
      )
    }

    if (asambleistaActual) {
      await supabaseAdmin.from("asambleista_dispositivo_alertas").insert({
        asamblea_id: asambleistaActual.asamblea_id,
        asambleista_id: asambleistaActual.id,
        credencial: asambleistaActual.credencial,
        dispositivo_autorizado_id: asambleistaActual.dispositivo_autorizado_id,
        dispositivo_intento_id: null,
        accion: "reset_autorizado",
        detalle: `Dispositivo autorizado reiniciado por ${req.cookies.get("auth_name")?.value || "Usuario autorizado"}`,
      })
    }

    await registrarAuditoria(supabaseAdmin, req, {
      asambleaId: asambleistaActual?.asamblea_id,
      asambleistaId: id,
      accion: "liberar_dispositivo",
      detalle: asambleistaActual?.credencial || null,
    })

    return NextResponse.json({ ok: true, asambleista: data })
  }

  if (
    accion === "activar_credencial" ||
    accion === "reenviar_credencial" ||
    accion === "reenviar_email" ||
    accion === "reenviar_sms"
  ) {
    const { data: asambleistaActual, error: errorActual } = await supabaseAdmin
      .from("asambleistas")
      .select("id, nombre, credencial, email, telefono, metodo_voto")
      .eq("id", id)
      .single()

    if (errorActual || !asambleistaActual) {
      return NextResponse.json({ ok: false, error: "NO_EXISTE" }, { status: 404 })
    }

    const enviarEmail = accion !== "reenviar_sms"
    const enviarSms = accion !== "reenviar_email"

    const resultadoEmail = enviarEmail
      ? await enviarCredencialPorEmail({
          email: asambleistaActual.email || "",
          nombre: asambleistaActual.nombre,
          credencial: asambleistaActual.credencial,
          metodoVoto:
            asambleistaActual.metodo_voto === "manual" ? "manual" : "electronico",
        })
      : undefined
    const resultadoSms = enviarSms
      ? await enviarCredencialPorSms({
          telefono: asambleistaActual.telefono || "",
          nombre: asambleistaActual.nombre,
          credencial: asambleistaActual.credencial,
        })
      : undefined

    const cambiosEnvio: Record<string, boolean | string | null> =
      accion === "activar_credencial"
        ? {
            registrado: true,
            pago_confirmado: true,
            habilitado: true,
            habilitado_en: new Date().toISOString(),
          }
        : {}

    if (resultadoEmail) {
      cambiosEnvio.credencial_email_enviado_en = resultadoEmail.enviado
        ? new Date().toISOString()
        : null
      cambiosEnvio.credencial_email_error = resultadoEmail.error || null
    }

    if (resultadoSms) {
      cambiosEnvio.credencial_sms_enviado_en = resultadoSms.enviado
        ? new Date().toISOString()
        : null
      cambiosEnvio.credencial_sms_error = resultadoSms.error || null
    }

    const { data, error } = await supabaseAdmin
      .from("asambleistas")
      .update(cambiosEnvio)
      .eq("id", id)
      .select("*")
      .single()

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message || "ERROR_ACTIVAR_CREDENCIAL" },
        { status: 500 }
      )
    }

    await registrarAuditoria(supabaseAdmin, req, {
      asambleaId: asambleistaPermitido.asamblea_id,
      asambleistaId: id,
      accion,
      detalle: asambleistaActual.credencial,
    })

    return NextResponse.json({
      ok: true,
      asambleista: data,
      credencialEmail: resultadoEmail,
      credencialSms: resultadoSms,
    })
  }

  if (accion === "mantener_dispositivo_actual") {
    const { data: asambleistaActual } = await supabaseAdmin
      .from("asambleistas")
      .select("id, asamblea_id, credencial, dispositivo_autorizado_id")
      .eq("id", id)
      .single()

    const { data, error } = await supabaseAdmin
      .from("asambleistas")
      .update({
        dispositivo_alerta_en: null,
        dispositivo_alerta_detalle: null,
      })
      .eq("id", id)
      .select("*")
      .single()

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message || "ERROR_MANTENER_DISPOSITIVO" },
        { status: 500 }
      )
    }

    if (asambleistaActual) {
      await supabaseAdmin.from("asambleista_dispositivo_alertas").insert({
        asamblea_id: asambleistaActual.asamblea_id,
        asambleista_id: asambleistaActual.id,
        credencial: asambleistaActual.credencial,
        dispositivo_autorizado_id: asambleistaActual.dispositivo_autorizado_id,
        dispositivo_intento_id: null,
        accion: "dispositivo_anterior_mantenido",
        detalle: `Dispositivo anterior mantenido por ${req.cookies.get("auth_name")?.value || "Usuario autorizado"}`,
      })
    }

    await registrarAuditoria(supabaseAdmin, req, {
      asambleaId: asambleistaActual?.asamblea_id,
      asambleistaId: id,
      accion: "mantener_dispositivo_actual",
      detalle: asambleistaActual?.credencial || null,
    })

    return NextResponse.json({ ok: true, asambleista: data })
  }

  if (accion === "autorizar_dispositivo_intento") {
    const { data: asambleistaActual } = await supabaseAdmin
      .from("asambleistas")
      .select("id, asamblea_id, credencial, dispositivo_autorizado_id")
      .eq("id", id)
      .single()

    if (!asambleistaActual) {
      return NextResponse.json({ ok: false, error: "NO_EXISTE" }, { status: 404 })
    }

    const { data: alertaReciente } = await supabaseAdmin
      .from("asambleista_dispositivo_alertas")
      .select("dispositivo_intento_id")
      .eq("asambleista_id", id)
      .not("dispositivo_intento_id", "is", null)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!alertaReciente?.dispositivo_intento_id) {
      return NextResponse.json(
        { ok: false, error: "NO_HAY_DISPOSITIVO_NUEVO" },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from("asambleistas")
      .update({
        dispositivo_autorizado_id: alertaReciente.dispositivo_intento_id,
        dispositivo_autorizado_en: new Date().toISOString(),
        dispositivo_alerta_en: null,
        dispositivo_alerta_detalle: null,
      })
      .eq("id", id)
      .select("*")
      .single()

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message || "ERROR_AUTORIZAR_DISPOSITIVO" },
        { status: 500 }
      )
    }

    await supabaseAdmin.from("asambleista_dispositivo_alertas").insert({
      asamblea_id: asambleistaActual.asamblea_id,
      asambleista_id: asambleistaActual.id,
      credencial: asambleistaActual.credencial,
      dispositivo_autorizado_id: asambleistaActual.dispositivo_autorizado_id,
      dispositivo_intento_id: alertaReciente.dispositivo_intento_id,
      accion: "nuevo_dispositivo_autorizado",
      detalle: `Nuevo dispositivo autorizado por ${req.cookies.get("auth_name")?.value || "Usuario autorizado"}`,
    })

    await registrarAuditoria(supabaseAdmin, req, {
      asambleaId: asambleistaActual.asamblea_id,
      asambleistaId: id,
      accion: "autorizar_dispositivo_nuevo",
      detalle: asambleistaActual.credencial,
    })

    return NextResponse.json({ ok: true, asambleista: data })
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

  await registrarAuditoria(supabaseAdmin, req, {
    asambleaId: asambleistaPermitido.asamblea_id,
    asambleistaId: id,
    accion: "actualizar_asambleista",
    detalle: Object.keys(cambiosPermitidos).join(", "),
  })

  return NextResponse.json({ ok: true, asambleista: data })
}
