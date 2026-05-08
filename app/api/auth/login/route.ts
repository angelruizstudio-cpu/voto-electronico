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
  userId: string
) {
  const opciones = {
    path: "/",
    maxAge: 7200,
    httpOnly: true,
    sameSite: "strict" as const,
  }

  response.cookies.set("auth_session", "true", opciones)
  response.cookies.set("auth_role", rol, opciones)
  response.cookies.set("auth_name", nombre, opciones)
  response.cookies.set("auth_user_id", userId, opciones)
  response.cookies.set("moderador_session", "true", opciones)
}

export async function POST(req: NextRequest) {
  try {
    const { username, password, rol } = await req.json()
    const rolSolicitado = String(rol || "")

    if (!ROLES_SISTEMA.includes(rolSolicitado as RolSistema)) {
      return NextResponse.json({ ok: false, error: "ROL_INVALIDO" }, { status: 400 })
    }

    const passwordCorrecta = process.env.MODERADOR_PASSWORD

    if (!username && passwordCorrecta && password === passwordCorrecta) {
      const response = NextResponse.json({ ok: true })
      setCookiesSesion(
        response,
        rolSolicitado as RolSistema,
        "Acceso administrativo",
        "emergency"
      )
      return response
    }

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "FALTAN_DATOS" }, { status: 400 })
    }

    const supabaseAdmin = crearSupabaseAdmin()
    const { data: usuario, error } = await supabaseAdmin
      .from("usuarios_sistema")
      .select("*")
      .eq("username", String(username).trim().toLowerCase())
      .maybeSingle()

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
      usuario.id
    )

    return response
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "ERROR_LOGIN" },
      { status: 500 }
    )
  }
}
