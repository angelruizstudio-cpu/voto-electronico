"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ClipboardCheck,
  DoorOpen,
  FileText,
  MonitorCheck,
  Scale,
  Shield,
  Smartphone,
  Users,
} from "lucide-react"

type RolAcceso = "admin" | "moderador" | "oficina" | "puerta" | "asambleista"

const roles: {
  id: RolAcceso
  label: string
  description: string
  href: string
  icon: typeof MonitorCheck
}[] = [
  {
    id: "admin",
    label: "Administrador",
    description: "Usuarios, permisos y configuración.",
    href: "/admin",
    icon: Shield,
  },
  {
    id: "moderador",
    label: "Moderador",
    description: "Asamblea, mociones y votaciones.",
    href: "/moderador",
    icon: MonitorCheck,
  },
  {
    id: "oficina",
    label: "Oficina",
    description: "Registro, pagos e historial.",
    href: "/oficina",
    icon: Users,
  },
  {
    id: "puerta",
    label: "Puerta",
    description: "Entrada y salida de participantes.",
    href: "/puerta",
    icon: DoorOpen,
  },
  {
    id: "asambleista",
    label: "Asambleísta",
    description: "Votación móvil y resultados.",
    href: "/asambleista",
    icon: Smartphone,
  },
]

export default function LoginPage() {
  const router = useRouter()
  const [rol, setRol] = useState<RolAcceso>("moderador")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [cargando, setCargando] = useState(false)
  const rolSeleccionado = roles.find((item) => item.id === rol) || roles[0]

  const login = async () => {
    if (rol === "asambleista") {
      router.push("/asambleista")
      return
    }

    if (!password) return
    setCargando(true)

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, rol }),
    })

    setCargando(false)

    if (!res.ok) {
      alert("Acceso denegado")
      return
    }

    router.push(rolSeleccionado.href)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") login()
  }

  return (
    <main className="min-h-screen bg-[#f3f1ea] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[minmax(460px,0.92fr)_minmax(620px,1.08fr)]">
        <section className="relative flex min-h-[360px] flex-col justify-between overflow-hidden bg-[#123b31] px-7 py-8 text-white sm:px-10 lg:min-h-screen lg:px-12">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#d1ad47]" />
          <div className="absolute bottom-[-180px] right-[-160px] h-[420px] w-[420px] rounded-full border border-[#d1ad47]/20" />
          <div className="absolute bottom-[-120px] right-[-100px] h-[280px] w-[280px] rounded-full border border-white/10" />

          <div className="relative z-10">
            <Image
              src="/kingdom_tech_group_logo.png"
              alt="Logo oficial"
              width={280}
              height={160}
              priority
              className="h-24 w-56 rounded-xl bg-white object-contain p-3 shadow-[0_18px_50px_rgba(0,0,0,0.25)]"
            />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#d8bd65]">
              Kingdom Tech Group
            </p>
          </div>

          <div className="relative z-10 max-w-xl py-12 lg:py-0">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d8bd65]">
              Sistema de votación de asamblea
            </p>
            <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl">
              Registro, participación y reportes oficiales en tiempo real
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/78">
              Una entrada organizada por rol para moderación, oficina, puerta,
              administración y asambleístas, con control seguro de cada sesión.
            </p>
          </div>

          <div className="relative z-10 grid gap-3 text-sm text-white/80 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <Scale className="mb-3 h-5 w-5 text-[#d8bd65]" />
              <p className="font-bold text-white">Control parlamentario</p>
              <p className="mt-1">Mociones y rondas</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <ClipboardCheck className="mb-3 h-5 w-5 text-[#d8bd65]" />
              <p className="font-bold text-white">Registro y presencia</p>
              <p className="mt-1">Pago y habilitación</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <FileText className="mb-3 h-5 w-5 text-[#d8bd65]" />
              <p className="font-bold text-white">Actas y reportes</p>
              <p className="mt-1">PDF e historial</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-3xl rounded-xl border border-[#ded6c3] bg-white p-5 shadow-[0_22px_70px_rgba(15,23,42,0.12)] sm:p-6 lg:p-8">
            <div className="mb-7 h-1 w-full rounded-full bg-gradient-to-r from-[#d1ad47] via-[#f1dc8a] to-[#123b31]" />

            <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#80651f]">
                  Acceso seguro
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                  Selecciona tu área
                </h2>
              </div>
              <p className="rounded-full border border-[#e4d6ab] bg-[#fbf7e8] px-3 py-1 text-xs font-semibold text-[#6f5b1d]">
                Sesión protegida por rol y usuario
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {roles.map((item) => {
                const Icon = item.icon
                const activo = rol === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRol(item.id)}
                    className={[
                      "min-h-[108px] rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d1ad47]",
                      activo
                        ? "border-[#d1ad47] bg-[#123b31] text-white shadow-[0_12px_24px_rgba(18,59,49,0.22)]"
                        : "border-slate-200 bg-white text-slate-900 hover:border-[#d1ad47] hover:bg-[#fbfaf5]",
                    ].join(" ")}
                    aria-pressed={activo}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={[
                          "flex size-10 shrink-0 items-center justify-center rounded-lg border",
                          activo
                            ? "border-[#d1ad47]/50 bg-white/10 text-[#f1dc8a]"
                            : "border-slate-200 bg-slate-50 text-[#1f5b4f]",
                        ].join(" ")}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block font-black">{item.label}</span>
                        <span
                          className={[
                            "mt-1 block text-sm leading-5",
                            activo ? "text-white/72" : "text-slate-500",
                          ].join(" ")}
                        >
                          {item.description}
                        </span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {rol !== "asambleista" && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700" htmlFor="username">
                    Usuario
                  </label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="nombre.usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-12 border-slate-200 bg-[#f7f8f3]"
                  />
                </div>
              )}

              <div className={rol === "asambleista" ? "space-y-2 sm:col-span-2" : "space-y-2"}>
                <label className="text-sm font-bold text-slate-700" htmlFor="password">
                  Contraseña
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder={
                    rol === "asambleista"
                      ? "Los asambleístas entran con credencial en la próxima pantalla"
                      : "Contraseña"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={rol === "asambleista"}
                  className="h-12 border-slate-200 bg-[#f7f8f3]"
                />
              </div>
            </div>

            <Button
              className="mt-5 h-12 w-full rounded-lg bg-[#123b31] text-white shadow-sm hover:bg-[#0d2d25]"
              onClick={login}
              disabled={cargando}
            >
              {cargando
                ? "Verificando..."
                : rol === "asambleista"
                ? "Continuar como Asambleísta"
                : "Entrar como " + rolSeleccionado.label}
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
