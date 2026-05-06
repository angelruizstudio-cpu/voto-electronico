import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()

    // Bug #7 corregido: contraseña validada en el servidor
    // La contraseña se lee de una variable de entorno — nunca viaja al cliente
    const passwordCorrecta = process.env.MODERADOR_PASSWORD

    if (!passwordCorrecta) {
      console.error("MODERADOR_PASSWORD no está configurada en las variables de entorno")
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    if (password !== passwordCorrecta) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })

    response.cookies.set("moderador_session", "true", {
      path: "/",
      maxAge: 7200,        // 2 horas
      httpOnly: true,      // No accesible desde JavaScript
      sameSite: "strict",
    })

    return response
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}