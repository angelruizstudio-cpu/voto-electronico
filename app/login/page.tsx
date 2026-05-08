"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DoorOpen, MonitorCheck, Shield, Smartphone, Users } from "lucide-react"

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
    description: "Usuarios, permisos y configuración del sistema.",
    href: "/admin",
    icon: Shield,
  },
  {
    id: "moderador",
    label: "Moderador",
    description: "Control de asamblea, mociones y votaciones.",
    href: "/moderador",
    icon: MonitorCheck,
  },
  {
    id: "oficina",
    label: "Oficina",
    description: "Registro, pagos, habilitación e historial.",
    href: "/oficina",
    icon: Users,
  },
  {
    id: "puerta",
    label: "Puerta",
    description: "Check-in y check-out de participantes.",
    href: "/puerta",
    icon: DoorOpen,
  },
  {
    id: "asambleista",
    label: "Asambleísta",
    description: "Entrada móvil para votar y ver resultados.",
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
    <main className="min-h-screen bg-[#f4f6f1] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
        <section className="relative flex min-h-[320px] flex-col justify-between overflow-hidden bg-[#16382f] px-6 py-8 text-white sm:px-10 lg:min-h-screen lg:px-12">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#c8a957]" />
          <div className="relative z-10 flex items-center gap-4">
            <Image
              src="/logo_voto_electronico.png"
              alt="Logo oficial"
              width={220}
              height={120}
              priority
              className="h-20 w-40 rounded-lg bg-white object-contain p-2 shadow-sm"
            />
          </div>

          <div className="relative z-10 max-w-lg py-12 lg:py-0">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d7c27a]">
              Sistema de votación
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
              Asamblea con registro, votación y reportes en tiempo real
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/78">
              Acceso organizado por rol para que cada equipo trabaje en su área:
              moderación, oficina, puerta, administración y asambleístas.
            </p>
          </div>

          <div className="relative z-10 grid gap-3 text-sm text-white/78 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="border-l border-[#c8a957] pl-3">
              <p className="font-bold text-white">Control</p>
              <p>Asamblea y mociones</p>
            </div>
            <div className="border-l border-[#c8a957] pl-3">
              <p className="font-bold text-white">Registro</p>
              <p>Pago y habilitación</p>
            </div>
            <div className="border-l border-[#c8a957] pl-3">
              <p className="font-bold text-white">Evidencia</p>
              <p>PDF e historial</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-8">
            <div className="mb-6 flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6f5b1d]">
                  Acceso seguro
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Selecciona tu área
                </h2>
              </div>
              <p className="text-sm text-slate-500">
                Sesión protegida por rol
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
                      "min-h-[104px] rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8a957]",
                      activo
                        ? "border-[#16382f] bg-[#16382f] text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-900 hover:border-[#c8a957] hover:bg-[#fbfaf5]",
                    ].join(" ")}
                    aria-pressed={activo}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={[
                          "flex size-10 shrink-0 items-center justify-center rounded-lg border",
                          activo
                            ? "border-white/20 bg-white/12 text-[#f1d779]"
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
                    className="h-11"
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
                  className="h-11"
                />
              </div>
            </div>

            <Button
              className="mt-5 h-11 w-full bg-[#16382f] text-white hover:bg-[#0f2b24]"
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
