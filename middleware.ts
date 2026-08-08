import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { obtenerSecretoSesion, sesionFirmadaValida } from "@/lib/session"

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

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const esApi = pathname.startsWith("/api/")

  const session =
    req.cookies.get("auth_session") || req.cookies.get("moderador_session")
  const secret = obtenerSecretoSesion()
  // Con SESSION_SECRET la firma es obligatoria; sin él se mantiene el
  // comportamiento anterior para no bloquear a nadie durante el despliegue.
  const firmaValida = secret ? await sesionFirmadaValida(req, secret) : true

  const rechazar = () => {
    if (esApi) {
      return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
    }

    const destino = pathname.startsWith("/sistema") ? "/ktgsga-admin" : "/login"
    return NextResponse.redirect(new URL(destino, req.url))
  }

  if (!session || !firmaValida) {
    return rechazar()
  }

  // Las rutas /api validan el rol específico internamente; aquí solo se garantiza
  // que la sesión exista y esté firmada (no falsificada).
  if (esApi) {
    return NextResponse.next()
  }

  const roles = leerRoles(req)

  const tieneRol = (rolesPermitidos: string[]) =>
    roles.includes("owner") || roles.includes("admin") || roles.some((rol) => rolesPermitidos.includes(rol))

  const permitido =
    (pathname.startsWith("/sistema") && roles.includes("owner")) ||
    (pathname.startsWith("/admin") && tieneRol(["admin"])) ||
    (pathname.startsWith("/moderador") && tieneRol(["moderador"])) ||
    (pathname.startsWith("/escrutinio") && tieneRol(["escrutinio"])) ||
    (pathname.startsWith("/oficina") && tieneRol(["oficina"])) ||
    (pathname.startsWith("/puerta") && tieneRol(["puerta"])) ||
    (pathname.startsWith("/historial") &&
      tieneRol(["moderador", "escrutinio", "oficina"])) ||
    (pathname.startsWith("/documentos") &&
      tieneRol(["moderador", "escrutinio", "oficina"])) ||
    pathname === "/"

  if (!permitido) {
    return rechazar()
  }

  return NextResponse.next()
}

// Protege las rutas administrativas (páginas) y las rutas API que mutan datos o
// exponen información sensible. Las rutas públicas del votante (checkin, vote,
// nominaciones, votacion-activa) y de login quedan fuera a propósito.
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
    "/historial",
    "/historial/:path*",
    "/documentos",
    "/documentos/:path*",
    "/api/asambleas",
    "/api/moderador/:path*",
    "/api/admin/:path*",
    "/api/oficina/:path*",
    "/api/escrutinio/:path*",
    "/api/sistema/:path*",
    "/api/votos-manuales",
    "/api/documentos/:path*",
    "/api/historial/:path*",
  ],
}
