import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createHash, randomUUID } from "crypto"
import { createClient } from "@supabase/supabase-js"
import { asambleaPerteneceAlTenant, obtenerTenantSesion } from "@/lib/tenant"
import {
  generarCredencialCandidata,
  limpiarEmail,
  limpiarTelefono,
  prepararPreRegistroMasivo,
  type PreRegistroValidado,
} from "@/lib/preRegistroMasivo"

type CambiosAsambleista = {
  nombre?: string
  email?: string | null
  telefono?: string | null
  iglesia?: string
  distrito?: string
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

async function generarCredencialUnica(
  supabaseAdmin: ReturnType<typeof crearSupabaseAdmin>,
  asambleaId: string,
  codigoTenant: string
) {
  for (let intento = 0; intento < 12; intento += 1) {
    const credencial = generarCredencialCandidata(codigoTenant)
    const { data, error } = await supabaseAdmin
      .from("asambleistas")
      .select("id")
      .eq("asamblea_id", asambleaId)
      .eq("credencial", credencial)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    if (!data) {
      return credencial
    }
  }

  throw new Error("NO_SE_PUDO_GENERAR_CREDENCIAL_UNICA")
}

function obtenerUrlAsambleista(tenant: ReturnType<typeof obtenerTenantSesion>) {
  const baseUrl = (process.env.APP_BASE_URL || "https://voto.kingdomtechgroup.org").replace(
    /\/+$/,
    ""
  )
  const org = encodeURIComponent(tenant.codigoAcceso || tenant.slug)

  return `${baseUrl}/votar?org=${org}`
}

function crearTokenAccesoAsambleista() {
  return `${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`
}

function hashTokenAcceso(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

async function obtenerUrlAsambleistaAutomatica({
  supabaseAdmin,
  tenant,
  asambleaId,
  asambleistaId,
}: {
  supabaseAdmin: ReturnType<typeof crearSupabaseAdmin>
  tenant: ReturnType<typeof obtenerTenantSesion>
  asambleaId: string
  asambleistaId: string
}) {
  const urlManual = obtenerUrlAsambleista(tenant)
  const token = crearTokenAccesoAsambleista()
  const tokenHash = hashTokenAcceso(token)

  const { error } = await supabaseAdmin.from("asambleista_access_links").upsert(
    {
      asamblea_id: asambleaId,
      asambleista_id: asambleistaId,
      token_hash: tokenHash,
      activo: true,
      expira_en: null,
      actualizado_en: new Date().toISOString(),
    },
    {
      onConflict: "asamblea_id,asambleista_id",
    }
  )

  if (error) {
    console.error("[Oficina] No se pudo generar enlace automatico de asambleista:", {
      asambleaId,
      asambleistaId,
      error: error.message,
    })

    return urlManual
  }

  return `${urlManual}&access=${encodeURIComponent(token)}`
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
  enlaceAsambleista,
}: {
  email: string
  nombre: string
  credencial: string
  metodoVoto: "electronico" | "manual"
  enlaceAsambleista: string
}): Promise<ResultadoEnvioCredencial> {
  if (!email) {
    return { enviado: false }
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || "Asamblea <onboarding@resend.dev>"
  const nombreHtml = escaparHtml(nombre)
  const credencialHtml = escaparHtml(credencial)
  const enlaceAsambleistaHtml = escaparHtml(enlaceAsambleista)
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
      ? `Saludos ${nombre},\n\nSu credencial de identificación para check-in/check-out en la asamblea es: ${credencial}\n\nEnlace de asambleísta: ${enlaceAsambleista}\n\nPresente esta credencial o el codigo QR en la puerta. Su voto será emitido por balota manual según el proceso de la asamblea.\n`
      : `Saludos ${nombre},\n\nSu credencial para hacer check-in en la asamblea es: ${credencial}\n\nEnlace de asambleísta: ${enlaceAsambleista}\n\nPresente esta credencial o el codigo QR en la puerta para agilizar su check-in/check-out. El token de votacion se genera aparte durante el check-in.\n`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <h1 style="font-size: 22px;">${esManual ? "Credencial de identificación de asamblea" : "Credencial de asamblea"}</h1>
        <p>Saludos ${nombreHtml},</p>
        <p>Su credencial ${esManual ? "de identificación para check-in/check-out" : "para hacer check-in en la asamblea"} es:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.08em;">${credencialHtml}</p>
        <p>
          Enlace de asambleísta:<br />
          <a href="${enlaceAsambleistaHtml}" style="color: #0f5132; font-weight: 700;">${enlaceAsambleistaHtml}</a>
        </p>
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
  enlaceAsambleista,
}: {
  telefono: string
  nombre: string
  credencial: string
  enlaceAsambleista: string
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
        enlace: enlaceAsambleista,
        var_3: enlaceAsambleista,
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
  const asambleaIdParam = req.nextUrl.searchParams.get("asambleaId")

  let queryAsamblea = supabaseAdmin
    .from("asambleas")
    .select("id, organizacion_id, organizacion_slug, estado")
    .in("estado", ["abierta", "receso"])

  if (asambleaIdParam) {
    queryAsamblea = queryAsamblea.eq("id", asambleaIdParam)
  } else if (tenant.id) {
    queryAsamblea = queryAsamblea.eq("organizacion_id", tenant.id)
  } else {
    queryAsamblea = queryAsamblea.eq("organizacion_slug", tenant.slug)
  }

  const { data: asambleaActiva, error: errorAsamblea } = await queryAsamblea
    .limit(1)
    .maybeSingle()

  if (errorAsamblea) {
    return NextResponse.json({ ok: false, error: errorAsamblea.message }, { status: 500 })
  }

  if (!asambleaActiva) {
    return NextResponse.json({ ok: true, asambleistas: [] })
  }

  if (!asambleaPerteneceAlTenant(tenant, asambleaActiva)) {
    return NextResponse.json({ ok: false, error: "ASAMBLEA_NO_AUTORIZADA" }, { status: 403 })
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

  const body = await req.json()
  const {
    asambleaId,
    nombre,
    iglesia,
    distrito,
    email,
    telefono,
    metodoVoto,
    enviarCredenciales = true,
    filas,
  } = body

  if (Array.isArray(filas)) {
    if (!asambleaId || filas.length === 0 || filas.length > 1000) {
      return NextResponse.json({ ok: false, error: "LOTE_INVALIDO" }, { status: 400 })
    }

    const supabaseAdmin = crearSupabaseAdmin()
    const tenant = obtenerTenantSesion(req)
    const { data: asambleaPermitida, error: errorAsambleaPermitida } = await supabaseAdmin
      .from("asambleas")
      .select("id, organizacion_id, organizacion_slug")
      .eq("id", asambleaId)
      .maybeSingle()

    if (errorAsambleaPermitida) {
      return NextResponse.json({ ok: false, error: errorAsambleaPermitida.message }, { status: 500 })
    }

    if (!asambleaPermitida || !asambleaPerteneceAlTenant(tenant, asambleaPermitida)) {
      return NextResponse.json({ ok: false, error: "ASAMBLEA_NO_AUTORIZADA" }, { status: 403 })
    }

    const { data: existentes, error: errorExistentes } = await supabaseAdmin
      .from("asambleistas")
      .select("credencial")
      .eq("asamblea_id", asambleaId)

    if (errorExistentes) {
      return NextResponse.json({ ok: false, error: errorExistentes.message }, { status: 500 })
    }

    const { registros, errores } = prepararPreRegistroMasivo({
      filas,
      codigoTenant: tenant.codigoAcceso || tenant.slug,
      credencialesOcupadas: new Set((existentes || []).map((item) => item.credencial)),
    })
    const prepararInsert = (registro: PreRegistroValidado) => ({
      asamblea_id: asambleaId,
      nombre: registro.nombre,
      credencial: registro.credencial,
      email: registro.email,
      telefono: registro.telefono,
      metodo_voto: registro.metodo_voto,
      iglesia: registro.iglesia,
      distrito: registro.distrito,
      registrado: false,
      pago_confirmado: false,
      habilitado: false,
      habilitado_en: null,
      presente: false,
    })
    let creados = 0

    for (let inicio = 0; inicio < registros.length; inicio += 200) {
      const lote = registros.slice(inicio, inicio + 200)
      const filasInsertar = lote.map(prepararInsert)
      const { error } = await supabaseAdmin.from("asambleistas").insert(filasInsertar)

      if (!error) {
        creados += lote.length
        continue
      }

      for (const registro of lote) {
        const { error: errorFila } = await supabaseAdmin
          .from("asambleistas")
          .insert(prepararInsert(registro))

        if (errorFila) {
          errores.push(`Fila ${registro.fila}: ${errorFila.message}`)
        } else {
          creados += 1
        }
      }
    }

    return NextResponse.json({ ok: true, creados, errores })
  }

  const nombreLimpio = String(nombre || "").trim()
  const emailLimpio = limpiarEmail(email)
  const telefonoLimpio = limpiarTelefono(telefono)
  const metodoVotoLimpio = metodoVoto === "manual" ? "manual" : "electronico"
  const activarAhora = enviarCredenciales !== false

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

  const { data: asambleaPermitida, error: errorAsambleaPermitida } = await supabaseAdmin
    .from("asambleas")
    .select("id, organizacion_id, organizacion_slug")
    .eq("id", asambleaId)
    .maybeSingle()

  if (errorAsambleaPermitida) {
    return NextResponse.json({ ok: false, error: errorAsambleaPermitida.message }, { status: 500 })
  }

  if (!asambleaPermitida || !asambleaPerteneceAlTenant(tenant, asambleaPermitida)) {
    return NextResponse.json({ ok: false, error: "ASAMBLEA_NO_AUTORIZADA" }, { status: 403 })
  }

  let credencial = ""

  try {
    credencial = await generarCredencialUnica(
      supabaseAdmin,
      asambleaId,
      tenant.codigoAcceso || tenant.slug
    )
  } catch (errorCredencial) {
    return NextResponse.json(
      {
        ok: false,
        error:
          errorCredencial instanceof Error
            ? errorCredencial.message
            : "ERROR_GENERAR_CREDENCIAL",
      },
      { status: 500 }
    )
  }

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
      registrado: activarAhora,
      pago_confirmado: activarAhora,
      habilitado: activarAhora,
      habilitado_en: activarAhora ? new Date().toISOString() : null,
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

  const enlaceAsambleista = await obtenerUrlAsambleistaAutomatica({
    supabaseAdmin,
    tenant,
    asambleaId,
    asambleistaId: data.id,
  })

  const resultadoEmail =
    enviarCredenciales === false
      ? { enviado: false }
      : await enviarCredencialPorEmail({
          email: emailLimpio,
          nombre: nombreLimpio,
          credencial,
          metodoVoto: metodoVotoLimpio,
          enlaceAsambleista,
        })
  const resultadoSms =
    enviarCredenciales === false
      ? { enviado: false }
      : await enviarCredencialPorSms({
          telefono: telefonoLimpio,
          nombre: nombreLimpio,
          credencial,
          enlaceAsambleista,
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

  const { id, cambios, accion } = await req.json()

  if (!id || (!accion && (!cambios || typeof cambios !== "object"))) {
    return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
  }

  const supabaseAdmin = crearSupabaseAdmin()
  const tenant = obtenerTenantSesion(req)

  const { data: asambleistaPermitido, error: errorAsambleistaPermitido } = await supabaseAdmin
    .from("asambleistas")
    .select("id, asamblea_id, email, telefono")
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

  const { data: asambleaPermitida } = await supabaseAdmin
    .from("asambleas")
    .select("id, organizacion_id, organizacion_slug")
    .eq("id", asambleistaPermitido.asamblea_id)
    .maybeSingle()

  if (!asambleaPermitida || !asambleaPerteneceAlTenant(tenant, asambleaPermitida)) {
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
      await supabaseAdmin
        .from("tokens_acceso")
        .update({ activo: false, bloqueado: false })
        .eq("asamblea_id", asambleistaActual.asamblea_id)
        .eq("asambleista_id", asambleistaActual.id)

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

    return NextResponse.json({ ok: true, asambleista: data })
  }

  if (accion === "activar_credencial") {
    const { data: asambleistaActual, error: errorActual } = await supabaseAdmin
      .from("asambleistas")
      .select("id, asamblea_id, nombre, credencial, email, telefono, metodo_voto")
      .eq("id", id)
      .single()

    if (errorActual || !asambleistaActual) {
      return NextResponse.json({ ok: false, error: "NO_EXISTE" }, { status: 404 })
    }

    const enlaceAsambleista = await obtenerUrlAsambleistaAutomatica({
      supabaseAdmin,
      tenant,
      asambleaId: asambleistaActual.asamblea_id,
      asambleistaId: asambleistaActual.id,
    })
    const resultadoEmail = await enviarCredencialPorEmail({
      email: asambleistaActual.email || "",
      nombre: asambleistaActual.nombre,
      credencial: asambleistaActual.credencial,
      metodoVoto:
        asambleistaActual.metodo_voto === "manual" ? "manual" : "electronico",
      enlaceAsambleista,
    })
    const resultadoSms = await enviarCredencialPorSms({
      telefono: asambleistaActual.telefono || "",
      nombre: asambleistaActual.nombre,
      credencial: asambleistaActual.credencial,
      enlaceAsambleista,
    })

    const { data, error } = await supabaseAdmin
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
      .eq("id", id)
      .select("*")
      .single()

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: error?.message || "ERROR_ACTIVAR_CREDENCIAL" },
        { status: 500 }
      )
    }

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
      await supabaseAdmin
        .from("tokens_acceso")
        .update({ bloqueado: false })
        .eq("asamblea_id", asambleistaActual.asamblea_id)
        .eq("asambleista_id", asambleistaActual.id)

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

    await supabaseAdmin
      .from("tokens_acceso")
      .update({ activo: false, bloqueado: false })
      .eq("asamblea_id", asambleistaActual.asamblea_id)
      .eq("asambleista_id", asambleistaActual.id)

    await supabaseAdmin.from("asambleista_dispositivo_alertas").insert({
      asamblea_id: asambleistaActual.asamblea_id,
      asambleista_id: asambleistaActual.id,
      credencial: asambleistaActual.credencial,
      dispositivo_autorizado_id: asambleistaActual.dispositivo_autorizado_id,
      dispositivo_intento_id: alertaReciente.dispositivo_intento_id,
      accion: "nuevo_dispositivo_autorizado",
      detalle: `Nuevo dispositivo autorizado por ${req.cookies.get("auth_name")?.value || "Usuario autorizado"}`,
    })

    return NextResponse.json({ ok: true, asambleista: data })
  }

  const cambiosPermitidos: CambiosAsambleista = {}

  if ("nombre" in cambios) {
    const nombre = String(cambios.nombre || "").trim()

    if (!nombre || nombre.length > 160) {
      return NextResponse.json({ ok: false, error: "NOMBRE_INVALIDO" }, { status: 400 })
    }

    cambiosPermitidos.nombre = nombre
  }

  if ("email" in cambios) {
    const emailOriginal = String(cambios.email || "").trim()
    const email = limpiarEmail(emailOriginal)

    if (emailOriginal && !email) {
      return NextResponse.json({ ok: false, error: "EMAIL_INVALIDO" }, { status: 400 })
    }

    cambiosPermitidos.email = email || null
  }

  if ("telefono" in cambios) {
    const telefonoOriginal = String(cambios.telefono || "").trim()
    const telefono = limpiarTelefono(telefonoOriginal)

    if (telefonoOriginal && !telefono) {
      return NextResponse.json({ ok: false, error: "TELEFONO_INVALIDO" }, { status: 400 })
    }

    cambiosPermitidos.telefono = telefono || null
  }

  for (const campo of ["iglesia", "distrito"] as const) {
    if (campo in cambios) {
      const valor = String(cambios[campo] || "").trim()

      if (valor.length > 160) {
        return NextResponse.json({ ok: false, error: `${campo.toUpperCase()}_INVALIDO` }, { status: 400 })
      }

      cambiosPermitidos[campo] = valor
    }
  }

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

  const cambiosParaGuardar: Record<string, boolean | string | null> = { ...cambiosPermitidos }

  if ("email" in cambiosPermitidos && cambiosPermitidos.email !== asambleistaPermitido.email) {
    cambiosParaGuardar.credencial_email_enviado_en = null
    cambiosParaGuardar.credencial_email_error = null
  }

  if (
    "telefono" in cambiosPermitidos &&
    cambiosPermitidos.telefono !== asambleistaPermitido.telefono
  ) {
    cambiosParaGuardar.credencial_sms_enviado_en = null
    cambiosParaGuardar.credencial_sms_error = null
  }

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
