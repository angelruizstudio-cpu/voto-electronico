import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ROLES_SISTEMA, verificarPassword, type RolSistema } from "@/lib/auth"
import { limpiarCodigoAccesoOrganizacion, limpiarSlugOrganizacion } from "@/lib/tenant"

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function buscarOrganizacionActiva(
  supabaseAdmin: ReturnType<typeof crearSupabaseAdmin>,
  valor: string
) {
  const slug = limpiarSlugOrganizacion(valor)
  const codigo = limpiarCodigoAccesoOrganizacion(valor)

  if (!slug && !codigo) return null

  const { data } = await supabaseAdmin
    .from("organizaciones")
    .select("id, nombre, slug, codigo_acceso")
    .or(`slug.eq.${slug},codigo_acceso.eq.${codigo}`)
    .eq("activa", true)
    .maybeSingle()

  return data || null
}

function setCookiesSesion(
  response: NextResponse,
  rol: RolSistema,
  nombre: string,
  userId: string,
  roles: RolSistema[] = [rol],
  organizacion?: {
    id?: string | null
    nombre?: string | null
    slug?: string | null
    codigo_acceso?: string | null
  }
) {
  const opciones = {
    path: "/",
    maxAge: 7200,
    httpOnly: true,
    sameSite: "strict" as const,
  }

  response.cookies.set("auth_session", "true", opciones)
  response.cookies.set("auth_role", rol, opciones)
  response.cookies.set("auth_roles", JSON.stringify(roles), opciones)
  response.cookies.set("auth_name", nombre, opciones)
  response.cookies.set("auth_user_id", userId, opciones)
  response.cookies.set("auth_org_id", organizacion?.id || "", opciones)
  response.cookies.set("auth_org_name", organizacion?.nombre || "Kingdom Tech Group", opciones)
  response.cookies.set("auth_org_slug", organizacion?.slug || "kingdom-tech-group", opciones)
  response.cookies.set("auth_org_code", organizacion?.codigo_acceso || "KTG", opciones)
  response.cookies.set("moderador_session", "true", opciones)
}

export async function POST(req: NextRequest) {
  try {
    const { username, password, rol, organizacionSlug } = await req.json()
    const rolSolicitado = String(rol || "")
    const organizacionBuscada = String(organizacionSlug || "").trim()

    if (!ROLES_SISTEMA.includes(rolSolicitado as RolSistema)) {
      return NextResponse.json({ ok: false, error: "ROL_INVALIDO" }, { status: 400 })
    }

    if (rolSolicitado === "owner") {
      const ownerUsername = process.env.SYSTEM_OWNER_USERNAME || "owner"
      const ownerPassword = process.env.SYSTEM_OWNER_PASSWORD

      if (
        !ownerPassword ||
        String(username || "").trim().toLowerCase() !== ownerUsername.trim().toLowerCase() ||
        String(password || "") !== ownerPassword
      ) {
        return NextResponse.json({ ok: false, error: "ACCESO_DENEGADO" }, { status: 401 })
      }

      const response = NextResponse.json({ ok: true })
      setCookiesSesion(response, "owner", "Kingdom Tech Group", "system-owner", ["owner"], {
        id: null,
        nombre: "Kingdom Tech Group",
        slug: "kingdom-tech-group",
        codigo_acceso: "KTG",
      })
      response.cookies.set("auth_owner_session", "true", {
        path: "/",
        maxAge: 7200,
        httpOnly: true,
        sameSite: "strict",
      })
      return response
    }

    const passwordCorrecta = process.env.MODERADOR_PASSWORD

    if (!username && passwordCorrecta && password === passwordCorrecta) {
      let organizacionEmergencia = {
        id: process.env.DEFAULT_ORGANIZATION_ID || null,
        nombre: process.env.DEFAULT_ORGANIZATION_NAME || "Kingdom Tech Group",
        slug: process.env.DEFAULT_ORGANIZATION_SLUG || "kingdom-tech-group",
        codigo_acceso: process.env.DEFAULT_ORGANIZATION_CODE || "KTG",
      }

      if (organizacionBuscada) {
        const supabaseAdmin = crearSupabaseAdmin()
        const organizacion = await buscarOrganizacionActiva(supabaseAdmin, organizacionBuscada)

        if (!organizacion) {
          return NextResponse.json({ ok: false, error: "ORGANIZACION_INVALIDA" }, { status: 401 })
        }

        organizacionEmergencia = organizacion
      }

      const response = NextResponse.json({ ok: true })
      const rolesEmergencia =
        rolSolicitado === "admin" ? ROLES_SISTEMA : [rolSolicitado as RolSistema]
      setCookiesSesion(
        response,
        rolSolicitado as RolSistema,
        "Acceso administrativo",
        "emergency",
        rolesEmergencia,
        organizacionEmergencia
      )
      return response
    }

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
    }

    const supabaseAdmin = crearSupabaseAdmin()
    const organizacion = organizacionBuscada
      ? await buscarOrganizacionActiva(supabaseAdmin, organizacionBuscada)
      : null

    if (organizacionBuscada && !organizacion) {
      return NextResponse.json({ ok: false, error: "ORGANIZACION_INVALIDA" }, { status: 401 })
    }

    let queryUsuario = supabaseAdmin
      .from("usuarios_sistema")
      .select("*, organizaciones:organizacion_id!inner(id, nombre, slug, codigo_acceso)")
      .eq("username", String(username).trim().toLowerCase())

    if (organizacion?.id) {
      queryUsuario = queryUsuario.eq("organizacion_id", organizacion.id)
    }

    const { data: usuario, error } = await queryUsuario.maybeSingle()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    if (!usuario || !usuario.activo) {
      return NextResponse.json({ ok: false, error: "ACCESO_DENEGADO" }, { status: 401 })
    }

    if (!usuario.roles?.includes(rolSolicitado)) {
      return NextResponse.json({ ok: false, error: "ROL_NO_AUTORIZADO" }, { status: 403 })
    }

    const passwordOk = verificarPassword(
      String(password),
      usuario.password_salt,
      usuario.password_hash
    )

    if (!passwordOk) {
      return NextResponse.json({ ok: false, error: "ACCESO_DENEGADO" }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })
    setCookiesSesion(
      response,
      rolSolicitado as RolSistema,
      usuario.nombre,
      usuario.id,
      usuario.roles,
      {
        id: usuario.organizacion_id,
        nombre: usuario.organizaciones?.nombre,
        slug: usuario.organizaciones?.slug,
        codigo_acceso: usuario.organizaciones?.codigo_acceso,
      }
    )

    return response
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "ERROR_LOGIN" },
      { status: 500 }
    )
  }
}
