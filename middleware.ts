import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const ROLES = ["owner", "admin", "moderador", "escrutinio", "oficina", "puerta"] as const

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
    const destino = pathname.startsWith("/sistema") ? "/ktgsga-admin" : "/login"
    return NextResponse.redirect(new URL(destino, req.url))
  }

  const tieneRol = (rolesPermitidos: string[]) =>
    roles.includes("owner") || roles.includes("admin") || roles.some((rol) => rolesPermitidos.includes(rol))

  const permitido =
    (pathname.startsWith("/sistema") && roles.includes("owner")) ||
    (pathname.startsWith("/admin") && tieneRol(["admin"])) ||
    (pathname.startsWith("/moderador") && tieneRol(["moderador"])) ||
    (pathname.startsWith("/escrutinio") && tieneRol(["escrutinio"])) ||
    (pathname.startsWith("/oficina") && tieneRol(["oficina"])) ||
    (pathname.startsWith("/puerta") && tieneRol(["puerta"])) ||
    pathname === "/"

  if (!permitido) {
    const destino = pathname.startsWith("/sistema") ? "/ktgsga-admin" : "/login"
    return NextResponse.redirect(new URL(destino, req.url))
  }

  return NextResponse.next()
}

// Protege las rutas administrativas.
export const config = {
  matcher: [
    "/",
    "/moderador",
    "/moderador/:path*",
    "/escrutinio",
    "/escrutinio/:path*",
    "/admin",
    "/admin/:path*",
    "/sistema",
    "/sistema/:path*",
    "/oficina",
    "/oficina/:path*",
    "/puerta",
    "/puerta/:path*",
  ],
}
