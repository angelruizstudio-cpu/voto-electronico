import { redirect } from "next/navigation"
import { cookies } from "next/headers"

const rutasPorRol = {
  owner: "/sistema",
  admin: "/admin",
  moderador: "/moderador",
  oficina: "/oficina",
  puerta: "/puerta",
} as const

type RolRuta = keyof typeof rutasPorRol

async function leerRolesSesion() {
  const cookieStore = await cookies()
  const rolesCookie = cookieStore.get("auth_roles")?.value

  if (rolesCookie) {
    try {
      const roles = JSON.parse(rolesCookie)

      if (Array.isArray(roles)) {
        return roles.filter((rol): rol is RolRuta => rol in rutasPorRol)
      }
    } catch {
      return []
    }
  }

  const rol = cookieStore.get("auth_role")?.value
  return rol && rol in rutasPorRol ? [rol as RolRuta] : (["moderador"] as RolRuta[])
}

export default async function HomePage() {
  const roles = await leerRolesSesion()
  const rolDestino: RolRuta = roles.includes("owner")
    ? "owner"
    : roles.includes("admin")
      ? "admin"
      : roles[0] || "moderador"

  redirect(rutasPorRol[rolDestino])
}
