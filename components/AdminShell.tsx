"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  ClipboardCheck,
  DoorOpen,
  FileText,
  ListChecks,
  LogOut,
  Menu,
  MonitorCheck,
  Scale,
  Shield,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useAsamblea } from "@/hooks/useAsamblea"
import { useVotacion } from "@/hooks/useVotacion"
import { mostrarTipoVotacion } from "@/lib/votacionHelpers"
import { supabase } from "@/lib/supabaseClient"

type AdminShellProps = {
  children: React.ReactNode
  role: "oficina" | "moderador" | "escrutinio"
}

type RolSesion = "admin" | "moderador" | "escrutinio" | "oficina" | "puerta"

const navItems = {
  moderador: { href: "/moderador", label: "Moderador", icon: MonitorCheck },
  escrutinio: { href: "/escrutinio", label: "Escrutinio", icon: Scale },
  admin: { href: "/admin", label: "Administrador", icon: Shield },
  resumen: { href: "/moderador/resultados", label: "Resumen actual", icon: ListChecks },
  documentos: { href: "/documentos", label: "Documentos", icon: FileText },
  oficina: { href: "/oficina", label: "Oficina", icon: ClipboardCheck },
  puerta: { href: "/puerta", label: "Puerta", icon: DoorOpen },
}

const navKeysByRole: Record<RolSesion, (keyof typeof navItems)[]> = {
  admin: ["moderador", "escrutinio", "admin", "resumen", "documentos", "oficina", "puerta"],
  moderador: ["moderador", "resumen", "documentos"],
  escrutinio: ["escrutinio", "documentos"],
  oficina: ["oficina", "documentos"],
  puerta: ["puerta"],
}

function construirNav(roles: RolSesion[], roleFallback: AdminShellProps["role"]) {
  const rolesValidos = roles.length > 0 ? roles : [roleFallback]
  const keys = rolesValidos.includes("admin")
    ? navKeysByRole.admin
    : rolesValidos.flatMap((rol) => navKeysByRole[rol] || [])

  return Array.from(new Set(keys)).map((key) => navItems[key])
}

export function AdminShell({ children, role }: AdminShellProps) {
  return <AdminShellContent role={role}>{children}</AdminShellContent>
}

function AdminShellContent({ children, role }: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<{
    nombre: string
    rol: string
    roles: RolSesion[]
  } | null>(null)
  const [quorum, setQuorum] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { asambleaId, anioAsamblea, lugarAsamblea, organizacionAsamblea, estadoAsamblea } =
    useAsamblea()
  const { estado, titulo, tipoVotacion, votosEmitidos } = useVotacion(asambleaId)
  const nav = construirNav(usuario?.roles || [], role)
  const moduloActual = pathname.startsWith("/puerta")
    ? "Puerta"
    : pathname.startsWith("/admin")
      ? "Administrador"
      : pathname.startsWith("/escrutinio")
        ? "Escrutinio"
        : pathname.startsWith("/oficina")
          ? "Oficina"
          : "Moderador"

  useEffect(() => {
    queueMicrotask(async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) return
      const data = await res.json()
      if (data.ok) {
        setUsuario({
          nombre: data.nombre,
          rol: data.rol,
          roles: Array.isArray(data.roles) ? data.roles : [data.rol],
        })
      }
    })
  }, [])

  useEffect(() => {
    if (!asambleaId) {
      queueMicrotask(() => setQuorum(0))
      return
    }

    const cargarQuorum = async () => {
      const { count } = await supabase
        .from("asambleistas")
        .select("id", { count: "exact", head: true })
        .eq("asamblea_id", asambleaId)
        .eq("presente", true)

      setQuorum(count || 0)
    }

    void cargarQuorum()

    const canalQuorum = supabase
      .channel(`realtime-quorum-${asambleaId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "asambleistas",
          filter: `asamblea_id=eq.${asambleaId}`,
        },
        () => {
          void cargarQuorum()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalQuorum)
    }
  }, [asambleaId])

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#f4f6f1] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-[#d9dfd3] bg-[#16382f] px-3 py-3 text-white lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo_voto_electronico.png"
              alt="Logo oficial"
              width={56}
              height={56}
              className="size-11 rounded-lg bg-white object-cover shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d7c27a]">
                Asamblea
              </p>
              <p className="truncate text-lg font-black">{moduloActual}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
            aria-label={mobileNavOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {mobileNavOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-[#0f2b24] p-3 shadow-lg">
            <nav className="grid gap-2">
              {nav.map((item) => {
                const Icon = item.icon
                const active =
                  pathname === item.href ||
                  (item.href !== "/oficina" &&
                    item.href !== "/moderador" &&
                    item.href !== "/escrutinio" &&
                    pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={[
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition",
                      active
                        ? "bg-white text-[#16382f] shadow-sm"
                        : "text-white/76 hover:bg-white/10 hover:text-white",
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/8 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{usuario?.nombre || "Usuario"}</p>
                <p className="text-xs text-white/56">
                  Quórum: {quorum} ·{" "}
                  {asambleaId ? (estadoAsamblea === "receso" ? "Receso" : "Activa") : "Inactiva"}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/78 transition hover:bg-white hover:text-[#16382f]"
                title="Salir"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </header>

      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-[#d9dfd3] bg-[#16382f] text-white lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <Image
              src="/logo_voto_electronico.png"
              alt="Logo oficial"
              width={96}
              height={96}
              className="size-16 rounded-lg bg-white object-cover shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7c27a]">
                Asamblea
              </p>
              <p className="truncate text-lg font-black">
                {moduloActual}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map((item) => {
            const Icon = item.icon
            const active =
              pathname === item.href ||
              (item.href !== "/oficina" &&
                item.href !== "/moderador" &&
                item.href !== "/escrutinio" &&
                pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition",
                  active
                    ? "bg-white text-[#16382f] shadow-sm"
                    : "text-white/76 hover:bg-white/10 hover:text-white",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="rounded-lg border border-white/10 bg-white/8 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-black">{usuario?.nombre || "Usuario"}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/48">
                  {usuario?.rol || "sesión"}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/78 transition hover:bg-white hover:text-[#16382f]"
                title="Salir"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-lg bg-[#0f2b24] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d7c27a]">
                  Estado
                </p>
                <span
                  className={[
                    "rounded-full px-2 py-1 text-xs font-bold",
                    asambleaId
                      ? estadoAsamblea === "receso"
                        ? "bg-amber-400/14 text-amber-100"
                        : "bg-emerald-400/14 text-emerald-100"
                      : "bg-white/10 text-white/64",
                  ].join(" ")}
                >
                  {asambleaId ? (estadoAsamblea === "receso" ? "Receso" : "Activa") : "Inactiva"}
                </span>
              </div>
              <p className="mt-2 font-black">
                {asambleaId
                  ? organizacionAsamblea || "Organización no especificada"
                  : "Sin asamblea activa"}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-white/64">
                {asambleaId ? `Asamblea ${anioAsamblea} · ${lugarAsamblea}` : "No iniciada"}
              </p>
              <div className="mt-3 rounded-md border border-white/10 bg-white/8 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d7c27a]">
                  Quórum
                </p>
                <p className="mt-1 text-2xl font-black text-white">{quorum}</p>
                <p className="text-xs text-white/56">asambleístas presentes</p>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-white/6 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/48">
                Votación actual
              </p>
              <p className="mt-1 line-clamp-2 font-bold">{titulo || "Ninguna"}</p>
              {titulo && (
                <p className="mt-1 text-xs text-white/60">
                  {mostrarTipoVotacion(tipoVotacion)} · {estado} · {votosEmitidos} votos
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:ml-72">{children}</div>
    </div>
  )
}
