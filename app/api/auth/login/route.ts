import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ROLES_SISTEMA, verificarPassword, type RolSistema } from "@/lib/auth"

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function setCookiesSesion(
  response: NextResponse,
  rol: RolSistema,
  nombre: string,
  userId: string,
  roles: RolSistema[] = [rol],
  organizacion?: { id?: string | null; nombre?: string | null; slug?: string | null }
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
  response.cookies.set("moderador_session", "true", opciones)
}

export async function POST(req: NextRequest) {
  try {
    const { username, password, rol, organizacionSlug } = await req.json()
    const rolSolicitado = String(rol || "")
    const organizacionSlugSolicitada = String(organizacionSlug || "").trim().toLowerCase()

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
      }

      if (organizacionSlugSolicitada) {
        const supabaseAdmin = crearSupabaseAdmin()
        const { data: organizacion } = await supabaseAdmin
          .from("organizaciones")
          .select("id, nombre, slug")
          .eq("slug", organizacionSlugSolicitada)
          .eq("activa", true)
          .maybeSingle()

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
    let queryUsuario = supabaseAdmin
      .from("usuarios_sistema")
      .select("*, organizaciones:organizacion_id!inner(id, nombre, slug)")
      .eq("username", String(username).trim().toLowerCase())

    if (organizacionSlugSolicitada) {
      queryUsuario = queryUsuario.eq("organizaciones.slug", organizacionSlugSolicitada)
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
