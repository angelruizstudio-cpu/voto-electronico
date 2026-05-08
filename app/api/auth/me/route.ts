import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const autenticado =
    req.cookies.get("auth_session")?.value === "true" ||
    req.cookies.get("moderador_session")?.value === "true"

  if (!autenticado) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    rol: req.cookies.get("auth_role")?.value || "admin",
    nombre: req.cookies.get("auth_name")?.value || "Usuario",
  })
}
