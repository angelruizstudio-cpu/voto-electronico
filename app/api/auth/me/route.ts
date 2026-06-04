import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { ROLES_SISTEMA, type RolSistema } from "@/lib/auth"

function leerRoles(req: NextRequest): RolSistema[] {
  const rolesCookie = req.cookies.get("auth_roles")?.value

  if (rolesCookie) {
    try {
      const roles = JSON.parse(rolesCookie)

      if (Array.isArray(roles)) {
        return roles.filter((rol): rol is RolSistema => ROLES_SISTEMA.includes(rol))
      }
    } catch {
      return []
    }
  }

  const rol = req.cookies.get("auth_role")?.value
  return ROLES_SISTEMA.includes(rol as RolSistema) ? [rol as RolSistema] : ["admin"]
}

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
    roles: leerRoles(req),
    nombre: req.cookies.get("auth_name")?.value || "Usuario",
    organizacion: {
      id: req.cookies.get("auth_org_id")?.value || null,
      nombre: req.cookies.get("auth_org_name")?.value || "Kingdom Tech Group",
      slug: req.cookies.get("auth_org_slug")?.value || "kingdom-tech-group",
    },
  })
}
