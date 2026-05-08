"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowRight,
  CheckCircle,
  DoorOpen,
  EyeOff,
  FileText,
  Gavel,
  Lock,
  MonitorCheck,
  Shield,
  Smartphone,
  User,
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
    <main className="min-h-screen overflow-hidden bg-[#f4efe5] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[minmax(560px,0.95fr)_minmax(700px,1.05fr)]">
        <section className="relative flex min-h-[420px] flex-col justify-between overflow-hidden bg-[#062f26] px-8 py-10 text-white sm:px-12 lg:min-h-screen lg:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_16%,rgba(49,117,93,0.5),transparent_34%),linear-gradient(145deg,rgba(0,0,0,0.12),rgba(0,0,0,0.45))]" />
          <div className="absolute inset-x-0 bottom-0 h-[48%] bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.12),transparent_45%)] opacity-50" />
          <div className="absolute left-[-18%] top-[-16%] h-[58%] w-[110%] rounded-[50%] border border-white/8 bg-white/[0.035]" />
          <div className="absolute right-[-96px] top-0 z-10 hidden h-full w-[142px] rounded-l-[55%] border-l-4 border-[#d7b257] bg-[#f4efe5] shadow-[-10px_0_0_rgba(215,178,87,0.25)] lg:block" />

          <div className="relative z-20">
            <Image
              src="/kingdom_tech_group_logo.png"
              alt="Logo Kingdom Tech Group"
              width={480}
              height={260}
              priority
              className="h-36 w-[28rem] max-w-full object-contain drop-shadow-[0_18px_35px_rgba(0,0,0,0.45)]"
            />
            <div className="mt-7 flex max-w-md items-center gap-3 text-[#d8b65f]">
              <div className="h-px flex-1 bg-[#d8b65f]" />
              <div className="h-2 w-2 rotate-45 border border-[#d8b65f]" />
              <div className="h-px flex-1 bg-[#d8b65f]" />
            </div>
          </div>

          <div className="relative z-20 max-w-xl py-14 lg:py-0">
            <h1 className="text-5xl font-black leading-[1.08] tracking-tight text-white drop-shadow sm:text-6xl">
              Sistema de
              <br />
              Votación de Asamblea
            </h1>
            <p className="mt-5 max-w-lg text-2xl font-bold leading-snug text-[#f2d77a]">
              Registro, participación y reportes oficiales en tiempo real
            </p>
            <div className="mt-7 h-px w-72 bg-[#d8b65f]" />
            <p className="mt-5 max-w-lg text-lg leading-8 text-white/82">
              Plataforma segura para la gestión parlamentaria de asambleas,
              votaciones y resultados oficiales.
            </p>
          </div>

          <div className="relative z-20 grid gap-4 text-center text-white sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="rounded-xl border border-[#d8b65f]/65 bg-[#062f26]/70 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.24)]">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border border-[#d8b65f] text-[#f2d77a]">
                <Gavel className="h-8 w-8" />
              </div>
              <p className="text-lg font-black">Control parlamentario</p>
            </div>
            <div className="rounded-xl border border-[#d8b65f]/65 bg-[#062f26]/70 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.24)]">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border border-[#d8b65f] text-[#f2d77a]">
                <Users className="h-8 w-8" />
              </div>
              <p className="text-lg font-black">Registro y presencia</p>
            </div>
            <div className="rounded-xl border border-[#d8b65f]/65 bg-[#062f26]/70 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.24)]">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border border-[#d8b65f] text-[#f2d77a]">
                <FileText className="h-8 w-8" />
              </div>
              <p className="text-lg font-black">Actas y reportes</p>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(215,178,87,0.18),transparent_22%),radial-gradient(circle_at_85%_70%,rgba(6,47,38,0.08),transparent_26%)]" />
          <div className="absolute right-0 top-0 h-full w-full opacity-35 [background-image:radial-gradient(#d7b257_1px,transparent_1px)] [background-size:18px_18px]" />

          <div className="relative w-full max-w-4xl rounded-xl border border-[#dbc891] bg-white/96 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10">
            <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-[#d7b257]" />

            <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex gap-4">
                <Shield className="mt-1 h-8 w-8 text-[#9c7620]" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#9c7620]">
                    Acceso seguro
                  </p>
                  <h2 className="mt-2 text-4xl font-black tracking-tight text-[#123b31]">
                    Selecciona tu área
                  </h2>
                </div>
              </div>
              <Image
                src="/kingdom_tech_group_logo.png"
                alt="Logo Kingdom Tech Group"
                width={190}
                height={92}
                className="h-16 w-44 object-contain"
              />
            </div>

            <div className="mb-7 flex max-w-xs items-center gap-3 text-[#d7b257]">
              <div className="h-px flex-1 bg-[#d7b257]" />
              <div className="h-2 w-2 rotate-45 border border-[#d7b257]" />
              <div className="h-px flex-1 bg-[#d7b257]" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {roles.map((item) => {
                const Icon = item.icon
                const activo = rol === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRol(item.id)}
                    className={[
                      "relative min-h-[120px] rounded-xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7b257]",
                      item.id === "asambleista" ? "sm:col-span-2" : "",
                      activo
                        ? "border-[#d7b257] bg-[#063d31] text-white shadow-[0_16px_34px_rgba(6,61,49,0.26)]"
                        : "border-slate-200 bg-white text-slate-900 shadow-sm hover:border-[#d7b257] hover:bg-[#fffdfa]",
                    ].join(" ")}
                    aria-pressed={activo}
                  >
                    {activo && (
                      <CheckCircle className="absolute right-4 top-4 h-6 w-6 fill-[#f2d77a] text-[#123b31]" />
                    )}
                    <div className="flex items-center gap-5">
                      <span
                        className={[
                          "flex size-16 shrink-0 items-center justify-center rounded-full border",
                          activo
                            ? "border-[#d7b257] bg-white/8 text-[#f2d77a]"
                            : "border-slate-200 bg-[#fbfaf5] text-[#9c7620]",
                        ].join(" ")}
                      >
                        <Icon className="h-8 w-8" />
                      </span>
                      <span>
                        <span className="block text-2xl font-black leading-tight">
                          {item.label}
                        </span>
                        <span
                          className={[
                            "mt-2 block text-base leading-6",
                            activo ? "text-white/82" : "text-slate-600",
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

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              {rol !== "asambleista" && (
                <div className="space-y-2">
                  <label className="text-base font-bold text-slate-800" htmlFor="username">
                    Usuario
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="Ingresa tu usuario"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="h-14 rounded-lg border-slate-200 bg-white pl-12 text-base"
                    />
                  </div>
                </div>
              )}

              <div className={rol === "asambleista" ? "space-y-2 sm:col-span-2" : "space-y-2"}>
                <label className="text-base font-bold text-slate-800" htmlFor="password">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={
                      rol === "asambleista"
                        ? "Los asambleístas entran con credencial en la próxima pantalla"
                        : "Ingresa tu contraseña"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={rol === "asambleista"}
                    className="h-14 rounded-lg border-slate-200 bg-white pl-12 pr-12 text-base"
                  />
                  <EyeOff className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            <Button
              className="mt-6 h-16 w-full rounded-lg border border-[#d7b257] bg-[#063d31] text-xl font-black text-white shadow-[0_18px_40px_rgba(6,61,49,0.22)] hover:bg-[#042d24]"
              onClick={login}
              disabled={cargando}
            >
              <span>
                {cargando
                  ? "Verificando..."
                  : rol === "asambleista"
                  ? "Continuar como Asambleísta"
                  : "Entrar como " + rolSeleccionado.label}
              </span>
              {!cargando && <ArrowRight className="ml-3 h-6 w-6 text-[#f2d77a]" />}
            </Button>

            <div className="mt-7 flex items-center gap-4 text-center text-sm text-slate-500">
              <div className="h-px flex-1 bg-slate-200" />
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span>Sesión protegida por rol y usuario</span>
              </div>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
