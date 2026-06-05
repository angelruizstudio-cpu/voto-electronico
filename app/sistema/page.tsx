"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, LogOut, Plus, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { sugerirCodigoAccesoOrganizacion } from "@/lib/tenant"

type Organizacion = {
  id: string
  nombre: string
  slug: string
  codigo_acceso: string | null
  activa: boolean
  creado_en: string
}

function slugSugerido(nombre: string) {
  return nombre
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export default function SistemaPage() {
  const router = useRouter()
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([])
  const [nombre, setNombre] = useState("")
  const [slug, setSlug] = useState("")
  const [codigoAcceso, setCodigoAcceso] = useState("")
  const [adminNombre, setAdminNombre] = useState("")
  const [adminUsername, setAdminUsername] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [cargando, setCargando] = useState(false)

  const slugPreview = useMemo(() => slugSugerido(slug || nombre), [nombre, slug])
  const codigoPreview = useMemo(
    () => (codigoAcceso || sugerirCodigoAccesoOrganizacion(nombre)).trim().toUpperCase(),
    [codigoAcceso, nombre]
  )

  const cargarOrganizaciones = useCallback(async () => {
    const res = await fetch("/api/sistema/organizaciones")
    const data = await res.json()

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudieron cargar las organizaciones")
      return
    }

    setOrganizaciones(data.organizaciones || [])
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarOrganizaciones()
    })
  }, [cargarOrganizaciones])

  const crearOrganizacion = async () => {
    if (!nombre.trim() || !adminNombre.trim() || !adminUsername.trim() || adminPassword.length < 8) {
      alert("Completa organización, administrador, usuario y contraseña de al menos 8 caracteres.")
      return
    }

    setCargando(true)
    const res = await fetch("/api/sistema/organizaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        slug: slugPreview,
        codigoAcceso: codigoPreview,
        adminNombre,
        adminUsername,
        adminPassword,
      }),
    })
    const data = await res.json()
    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudo crear la organización")
      return
    }

    setNombre("")
    setSlug("")
    setCodigoAcceso("")
    setAdminNombre("")
    setAdminUsername("")
    setAdminPassword("")
    await cargarOrganizaciones()
  }

  const cambiarEstado = async (organizacion: Organizacion) => {
    setCargando(true)
    const res = await fetch("/api/sistema/organizaciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: organizacion.id, activa: !organizacion.activa }),
    })
    const data = await res.json()
    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudo actualizar la organización")
      return
    }

    await cargarOrganizaciones()
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/ktgsga-admin")
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#f4f6f1] p-6 text-slate-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-xl border border-[#d9dfd3] bg-[#16382f] p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-xl bg-white text-[#16382f]">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d7c27a]">
                Kingdom Tech Group
              </p>
              <h1 className="text-3xl font-black">Dueño del sistema</h1>
              <p className="mt-1 text-sm text-white/70">
                Organizaciones cliente y acceso inicial.
              </p>
            </div>
          </div>
          <Button type="button" onClick={logout} className="bg-white text-[#16382f] hover:bg-white/90">
            <LogOut className="mr-2 h-4 w-4" />
            Salir
          </Button>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#f4efe5] text-[#9c7620]">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black">Crear organización cliente</h2>
              <p className="text-sm text-slate-500">
                Esto crea la organización y su primer usuario administrador.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre de la organización"
              className="h-12"
            />
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={`Slug sugerido: ${slugPreview || "mi-organizacion"}`}
              className="h-12"
            />
            <Input
              value={codigoAcceso}
              onChange={(e) => setCodigoAcceso(e.target.value.toUpperCase())}
              placeholder={`Código corto sugerido: ${codigoPreview || "ORG"}`}
              className="h-12"
            />
            <Input
              value={adminNombre}
              onChange={(e) => setAdminNombre(e.target.value)}
              placeholder="Nombre del administrador"
              className="h-12"
            />
            <Input
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="Usuario administrador"
              className="h-12"
            />
            <Input
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Contraseña inicial"
              type="password"
              className="h-12"
            />
            <Button
              type="button"
              onClick={crearOrganizacion}
              disabled={cargando}
              className="h-12 bg-[#16382f] font-black hover:bg-[#0f2b24]"
            >
              Crear organización
            </Button>
          </div>

          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">
            Slug final: <span className="text-[#16382f]">{slugPreview || "pendiente"}</span>
            {" · "}
            Código para enlace: <span className="text-[#16382f]">{codigoPreview || "pendiente"}</span>
            {" · "}
            Link:{" "}
            <span className="text-[#16382f]">
              {codigoPreview ? `/votar?org=${codigoPreview}` : "pendiente"}
            </span>
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#f4efe5] text-[#9c7620]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black">Organizaciones</h2>
              <p className="text-sm text-slate-500">
                Solo las organizaciones activas aparecen en el login.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {organizaciones.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-4 text-slate-500">
                No hay organizaciones creadas.
              </p>
            ) : (
              organizaciones.map((organizacion) => (
                <div
                  key={organizacion.id}
                  className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="text-lg font-black">{organizacion.nombre}</p>
                    <p className="text-sm font-semibold text-slate-500">
                      {organizacion.slug}
                    </p>
                    <p className="mt-1 text-sm font-black text-[#16382f]">
                      Link corto: /votar?org={organizacion.codigo_acceso || organizacion.slug}
                    </p>
                    <p
                      className={
                        organizacion.activa
                          ? "mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700"
                          : "mt-2 inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700"
                      }
                    >
                      {organizacion.activa ? "Activa" : "Inactiva"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => cambiarEstado(organizacion)}
                    disabled={cargando}
                    variant="outline"
                  >
                    {organizacion.activa ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
