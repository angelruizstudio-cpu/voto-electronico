import type { NextRequest } from "next/server"

export type TenantSesion = {
  id: string | null
  nombre: string
  slug: string
  codigoAcceso: string
}

export function obtenerTenantSesion(req: NextRequest): TenantSesion {
  return {
    id: req.cookies.get("auth_org_id")?.value || null,
    nombre: req.cookies.get("auth_org_name")?.value || "Kingdom Tech Group",
    slug: req.cookies.get("auth_org_slug")?.value || "kingdom-tech-group",
    codigoAcceso: req.cookies.get("auth_org_code")?.value || "KTG",
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

export function limpiarCodigoAccesoOrganizacion(valor: unknown) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8)
}

export function sugerirCodigoAccesoOrganizacion(nombre: string) {
  const limpio = String(nombre || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")

  if (!limpio) return ""

  const palabras = limpio.split(" ").filter(Boolean)
  const iniciales = palabras.map((palabra) => palabra[0]).join("")

  if (iniciales.length >= 2) {
    return iniciales.slice(0, 5)
  }

  return limpiarCodigoAccesoOrganizacion(limpio).slice(0, 5)
}
