import type { NextRequest } from "next/server"

export type TenantSesion = {
  id: string | null
  nombre: string
  slug: string
}

export function obtenerTenantSesion(req: NextRequest): TenantSesion {
  return {
    id: req.cookies.get("auth_org_id")?.value || null,
    nombre: req.cookies.get("auth_org_name")?.value || "Kingdom Tech Group",
    slug: req.cookies.get("auth_org_slug")?.value || "kingdom-tech-group",
  }
}

export function obtenerOrganizacionId(req: NextRequest) {
  return obtenerTenantSesion(req).id
}

export function limpiarSlugOrganizacion(valor: unknown) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
