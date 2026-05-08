import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const session =
    req.cookies.get("auth_session") || req.cookies.get("moderador_session")
  const rol = req.cookies.get("auth_role")?.value || "admin"
  const pathname = req.nextUrl.pathname

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const permitido =
    (pathname.startsWith("/admin") && rol === "admin") ||
    (pathname.startsWith("/moderador") &&
      ["admin", "moderador"].includes(rol)) ||
    (pathname.startsWith("/oficina") &&
      ["admin", "oficina", "moderador"].includes(rol)) ||
    (pathname.startsWith("/puerta") &&
      ["admin", "puerta", "oficina"].includes(rol)) ||
    pathname === "/"

  if (!permitido) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

// Protege las rutas administrativas.
export const config = {
  matcher: [
    "/",
    "/moderador",
    "/moderador/:path*",
    "/admin",
    "/admin/:path*",
    "/oficina",
    "/oficina/:path*",
    "/puerta",
    "/puerta/:path*",
  ],
}
