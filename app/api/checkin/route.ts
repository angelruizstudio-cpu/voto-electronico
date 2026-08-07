import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"
import { limpiarCodigoAccesoOrganizacion, limpiarSlugOrganizacion } from "@/lib/tenant"

type AsambleaCheckin = {
  id: string
  organizacion: string
  anio: number
  lugar: string
  estado: string
  organizacion_id?: string | null
  organizacion_slug?: string | null
}

type AsambleistaCheckin = {
  id: string
  nombre: string
  credencial: string
  habilitado: boolean
  presente: boolean
  metodo_voto: string
  dispositivo_autorizado_id: string | null
  dispositivo_alerta_en: string | null
}


function hashTokenAcceso(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { credencial, deviceId, orgSlug, accessToken } = await req.json()

    if ((!credencial && !accessToken) || !deviceId) {
      return NextResponse.json({ ok: false, error: "FALTA_CREDENCIAL" }, { status: 400 })
    }

    const credencialNormalizada = String(credencial).trim().toUpperCase()
    const accessTokenLimpio = String(accessToken || "").trim()
    const deviceIdNormalizado = String(deviceId).trim()
    const userAgent = req.headers.get("user-agent") || "unknown"
    const forwardedFor = req.headers.get("x-forwarded-for")
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown"

    let organizacionId: string | null = null
    const orgParam = String(orgSlug || "").trim()
    const orgSlugLimpio = limpiarSlugOrganizacion(orgParam)
    const orgCodigoLimpio = limpiarCodigoAccesoOrganizacion(orgParam)

    if (orgParam) {
      const { data: organizacion } = await supabaseAdmin
        .from("organizaciones")
        .select("id")
        .or(`slug.eq.${orgSlugLimpio},codigo_acceso.eq.${orgCodigoLimpio}`)
        .eq("activa", true)
        .maybeSingle()

      organizacionId = organizacion?.id || null
    }

    let asamblea: AsambleaCheckin | null = null
    let asambleista: AsambleistaCheckin | null = null

    if (accessTokenLimpio) {
      const { data: enlaceAcceso, error: errorEnlace } = await supabaseAdmin
        .from("asambleista_access_links")
        .select("id, asamblea_id, asambleista_id, activo, expira_en")
        .eq("token_hash", hashTokenAcceso(accessTokenLimpio))
        .eq("activo", true)
        .maybeSingle()

      if (errorEnlace) {
        return NextResponse.json({ ok: false, error: errorEnlace.message }, { status: 500 })
      }

      if (!enlaceAcceso) {
        return NextResponse.json({ ok: false, error: "TOKEN_ACCESO_INVALIDO" }, { status: 404 })
      }

      if (enlaceAcceso.expira_en && new Date(enlaceAcceso.expira_en).getTime() < Date.now()) {
        return NextResponse.json({ ok: false, error: "TOKEN_ACCESO_EXPIRADO" }, { status: 403 })
      }

      const { data: asambleaPorToken } = await supabaseAdmin
        .from("asambleas")
        .select("id, organizacion, anio, lugar, estado, organizacion_id, organizacion_slug")
        .eq("id", enlaceAcceso.asamblea_id)
        .maybeSingle()

      if (!asambleaPorToken || !["abierta", "receso"].includes(asambleaPorToken.estado)) {
        return NextResponse.json({ ok: false, error: "NO_HAY_ASAMBLEA" }, { status: 400 })
      }

      if (
        (organizacionId && asambleaPorToken.organizacion_id !== organizacionId) ||
        (!organizacionId && orgSlugLimpio && asambleaPorToken.organizacion_slug !== orgSlugLimpio)
      ) {
        return NextResponse.json({ ok: false, error: "ASAMBLEA_NO_AUTORIZADA" }, { status: 403 })
      }

      const { data: asambleistaPorToken } = await supabaseAdmin
        .from("asambleistas")
        .select("id, nombre, credencial, habilitado, presente, metodo_voto, dispositivo_autorizado_id, dispositivo_alerta_en")
        .eq("id", enlaceAcceso.asambleista_id)
        .eq("asamblea_id", asambleaPorToken.id)
        .maybeSingle()

      asamblea = asambleaPorToken
      asambleista = asambleistaPorToken
    } else {
      let queryAsamblea = supabaseAdmin
        .from("asambleas")
        .select("id, organizacion, anio, lugar, estado")
        .in("estado", ["abierta", "receso"])

      if (organizacionId) {
        queryAsamblea = queryAsamblea.eq("organizacion_id", organizacionId)
      } else if (orgSlugLimpio) {
        queryAsamblea = queryAsamblea.eq("organizacion_slug", orgSlugLimpio)
      }

      const { data: asambleaPorCredencial } = await queryAsamblea.maybeSingle()

      if (!asambleaPorCredencial) {
        return NextResponse.json({ ok: false, error: "NO_HAY_ASAMBLEA" }, { status: 400 })
      }

      const { data: asambleistaPorCredencial } = await supabaseAdmin
        .from("asambleistas")
        .select("id, nombre, credencial, habilitado, presente, metodo_voto, dispositivo_autorizado_id, dispositivo_alerta_en")
        .eq("asamblea_id", asambleaPorCredencial.id)
        .eq("credencial", credencialNormalizada)
        .maybeSingle()

      asamblea = asambleaPorCredencial
      asambleista = asambleistaPorCredencial
    }

    if (!asambleista) {
      return NextResponse.json(
        { ok: false, error: "NO_EXISTE" },
        { status: 404 }
      )
    }

    if (!asambleista.habilitado) {
      return NextResponse.json(
        {
          ok: false,
          error: "NO_HABILITADO",
        },
        { status: 403 }
      )
    }

    if (asambleista.metodo_voto === "manual") {
      return NextResponse.json(
        {
          ok: false,
          error: "VOTO_MANUAL",
        },
        { status: 403 }
      )
    }

    if (!asambleista.presente) {
      return NextResponse.json(
        {
          ok: false,
          error: "PENDIENTE_CHECKIN_PRESENCIAL",
        },
        { status: 403 }
      )
    }

    const credencialAuditada = asambleista.credencial || credencialNormalizada

    if (asambleista.dispositivo_alerta_en) {
      return NextResponse.json(
        { ok: false, error: "DISPOSITIVO_REVALIDACION_REQUERIDA" },
        { status: 409 }
      )
    }

    if (!asambleista.dispositivo_autorizado_id) {
      await supabaseAdmin
        .from("asambleistas")
        .update({
          dispositivo_autorizado_id: deviceIdNormalizado,
          dispositivo_autorizado_en: new Date().toISOString(),
        })
        .eq("id", asambleista.id)
    } else if (asambleista.dispositivo_autorizado_id !== deviceIdNormalizado) {
      const detalle = `Check-in desde otro dispositivo. IP: ${ip}. Navegador: ${userAgent.slice(0, 220)}`
      const alertaEn = new Date().toISOString()
      const [actualizacion, bloqueo, alerta] = await Promise.all([
        supabaseAdmin
          .from("asambleistas")
          .update({ dispositivo_alerta_en: alertaEn, dispositivo_alerta_detalle: detalle })
          .eq("id", asambleista.id),
        supabaseAdmin
          .from("tokens_acceso")
          .update({ bloqueado: true })
          .eq("asamblea_id", asamblea.id)
          .eq("asambleista_id", asambleista.id),
        supabaseAdmin.from("asambleista_dispositivo_alertas").insert({
          asamblea_id: asamblea.id,
          asambleista_id: asambleista.id,
          credencial: credencialAuditada,
          dispositivo_autorizado_id: asambleista.dispositivo_autorizado_id,
          dispositivo_intento_id: deviceIdNormalizado,
          ip,
          user_agent: userAgent,
          accion: "bloqueado",
          detalle,
        }),
      ])

      if (actualizacion.error || bloqueo.error || alerta.error) {
        return NextResponse.json({ ok: false, error: "ERROR_BLOQUEO_DISPOSITIVO" }, { status: 500 })
      }

      return NextResponse.json(
        { ok: false, error: "DISPOSITIVO_REVALIDACION_REQUERIDA" },
        { status: 409 }
      )
    }

    if (accessTokenLimpio) {
      await supabaseAdmin
        .from("asambleista_access_links")
        .update({ usado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() })
        .eq("token_hash", hashTokenAcceso(accessTokenLimpio))
    }

    const token = crypto.randomUUID().replace(/-/g, "")

    const { data: tokenGuardado, error } = await supabaseAdmin
      .from("tokens_acceso")
      .upsert(
        {
          asamblea_id: asamblea.id,
          asambleista_id: asambleista.id,
          token_hash: token,
          activo: true,
          bloqueado: false,
          expira_en: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        },
        {
          onConflict: "asamblea_id,asambleista_id",
        }
      )
      .select("token_hash")
      .single()

    if (error || !tokenGuardado) {
      return NextResponse.json(
        { ok: false, error: error?.message || "ERROR_TOKEN" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      token: tokenGuardado.token_hash,
      asamblea: {
        id: asamblea.id,
        organizacion: asamblea.organizacion,
        anio: asamblea.anio,
        lugar: asamblea.lugar,
        estado: asamblea.estado,
      },
      asambleista: {
        id: asambleista.id,
        nombre: asambleista.nombre,
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: "ERROR_SERVIDOR" }, { status: 500 })
  }
}
