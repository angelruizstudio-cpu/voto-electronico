import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const ROLES = ["admin", "moderador", "oficina", "puerta"] as const

function leerRoles(req: NextRequest) {
  const rolesCookie = req.cookies.get("auth_roles")?.value

  if (rolesCookie) {
    try {
      const roles = JSON.parse(rolesCookie)

      if (Array.isArray(roles)) {
        return roles.filter((rol) => ROLES.includes(rol))
      }
    } catch {
      return []
    }
  }

  const rol = req.cookies.get("auth_role")?.value
  return ROLES.includes(rol as (typeof ROLES)[number]) ? [rol] : ["admin"]
}

export function middleware(req: NextRequest) {
  const session =
    req.cookies.get("auth_session") || req.cookies.get("moderador_session")
  const roles = leerRoles(req)
  const pathname = req.nextUrl.pathname

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const tieneRol = (rolesPermitidos: string[]) =>
    roles.includes("admin") || roles.some((rol) => rolesPermitidos.includes(rol))

  const permitido =
    (pathname.startsWith("/admin") && tieneRol(["admin"])) ||
    (pathname.startsWith("/moderador") && tieneRol(["moderador"])) ||
    (pathname.startsWith("/oficina") && tieneRol(["oficina"])) ||
    (pathname.startsWith("/puerta") && tieneRol(["puerta"])) ||
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
