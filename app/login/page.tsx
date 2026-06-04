"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { LanguageToggle } from "@/components/LanguageToggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/lib/i18n"
import {
  ArrowRight,
  Building2,
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

type Organizacion = {
  id: string
  nombre: string
  slug: string
}

const roles: {
  id: RolAcceso
  labelEs: string
  labelEn: string
  descriptionEs: string
  descriptionEn: string
  href: string
  icon: typeof MonitorCheck
}[] = [
  {
    id: "admin",
    labelEs: "Administrador",
    labelEn: "Administrator",
    descriptionEs: "Usuarios, permisos y configuración.",
    descriptionEn: "Users, permissions, and configuration.",
    href: "/admin",
    icon: Shield,
  },
  {
    id: "moderador",
    labelEs: "Moderador",
    labelEn: "Moderator",
    descriptionEs: "Control de asamblea, mociones y votaciones.",
    descriptionEn: "Assembly control, motions, and voting.",
    href: "/moderador",
    icon: MonitorCheck,
  },
  {
    id: "oficina",
    labelEs: "Oficina",
    labelEn: "Office",
    descriptionEs: "Registro, pagos, habilitación e historial.",
    descriptionEn: "Registration, payments, approval, and history.",
    href: "/oficina",
    icon: Users,
  },
  {
    id: "puerta",
    labelEs: "Puerta",
    labelEn: "Door",
    descriptionEs: "Check-in y check-out de participantes.",
    descriptionEn: "Participant check-in and check-out.",
    href: "/puerta",
    icon: DoorOpen,
  },
  {
    id: "asambleista",
    labelEs: "Asambleísta",
    labelEn: "Assembly Member",
    descriptionEs: "Entrada móvil para votar y ver resultados.",
    descriptionEn: "Mobile access to vote and view results.",
    href: "/asambleista",
    icon: Smartphone,
  },
]

export default function LoginPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [rol, setRol] = useState<RolAcceso>("moderador")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([])
  const [organizacionSlug, setOrganizacionSlug] = useState("")
  const [cargando, setCargando] = useState(false)
  const rolSeleccionado = roles.find((item) => item.id === rol) || roles[0]

  useEffect(() => {
    const cargarOrganizaciones = async () => {
      const res = await fetch("/api/organizaciones").catch(() => null)

      if (!res?.ok) return

      const data = await res.json().catch(() => null)
      const lista = Array.isArray(data?.organizaciones) ? data.organizaciones : []

      setOrganizaciones(lista)

      const guardada = localStorage.getItem("organizacion_slug") || ""
      const inicial = lista.find((org: Organizacion) => org.slug === guardada)?.slug || lista[0]?.slug || ""
      setOrganizacionSlug(inicial)

      if (inicial) {
        localStorage.setItem("organizacion_slug", inicial)
      }
    }

    void cargarOrganizaciones()
  }, [])

  const login = async () => {
    if (rol === "asambleista") {
      const destino = organizacionSlug
        ? `/asambleista?org=${encodeURIComponent(organizacionSlug)}`
        : "/asambleista"
      router.push(destino)
      return
    }

    if (!organizacionSlug || !password) return
    setCargando(true)
    localStorage.setItem("organizacion_slug", organizacionSlug)

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, rol, organizacionSlug }),
    })

    setCargando(false)

    if (!res.ok) {
      alert(t("Acceso denegado", "Access denied"))
      return
    }

    router.push(rolSeleccionado.href)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") login()
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4efe5] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[47.5%_52.5%]">
        <section className="relative flex min-h-[520px] flex-col justify-between overflow-hidden bg-[#062f26] px-8 py-10 text-white sm:px-14 lg:min-h-screen lg:px-[6.6vw] lg:py-[7.8vh]">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,48,39,0.66),rgba(0,25,20,0.9)),radial-gradient(circle_at_30%_7%,rgba(55,122,97,0.62),transparent_32%),radial-gradient(ellipse_at_bottom,rgba(7,78,62,0.46),transparent_58%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[48%] bg-[linear-gradient(0deg,rgba(0,0,0,0.55),transparent),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.12),transparent_54%)] opacity-70" />
          <div className="absolute inset-x-0 bottom-0 h-[38%] opacity-25 [background-image:linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="absolute left-[-8%] top-[-18%] h-[46%] w-[112%] rounded-[50%] border border-white/8 bg-white/[0.035]" />
          <div className="absolute left-[-20%] top-[-12%] h-[46%] w-[122%] rounded-[50%] border border-white/10" />
          <div className="absolute bottom-[24%] left-0 h-[28%] w-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.09),transparent_58%)]" />
          <div className="absolute right-[-82px] top-0 z-10 hidden h-full w-[150px] rounded-l-[55%] border-l-[5px] border-[#d7b257] bg-[#f4efe5] shadow-[-12px_0_0_rgba(215,178,87,0.3)] lg:block" />

          <div className="relative z-20">
            <Image
              src="/KTG_Logo.png"
              alt="Logo Kingdom Tech Group"
              width={760}
              height={420}
              priority
              className="h-52 w-[44rem] max-w-full object-contain object-left drop-shadow-[0_22px_42px_rgba(0,0,0,0.55)] sm:h-60 sm:w-[50rem] lg:h-[16rem] lg:w-[45rem] xl:h-[17.5rem] xl:w-[49rem]"
            />
            <div className="-mt-14 flex max-w-[28rem] items-center gap-3 text-[#d8b65f] sm:-mt-16 lg:-mt-20">
              <div className="h-px flex-1 bg-[#d8b65f]" />
              <div className="h-2 w-2 rotate-45 border border-[#d8b65f]" />
              <div className="h-px flex-1 bg-[#d8b65f]" />
            </div>
          </div>

          <div className="relative z-20 max-w-[35rem] py-12 lg:py-0">
              <h1 className="text-5xl font-black leading-[1.08] tracking-tight text-white drop-shadow sm:text-6xl lg:text-[4.05rem]">
              {t("Sistema de Gestión", "Assembly Management")}
              <br />
              {t("de Asambleas", "System")}
            </h1>
            <p className="mt-5 max-w-[31rem] text-2xl font-bold leading-snug text-[#f2d77a] lg:text-[1.72rem]">
              {t(
                "Todo el control de su asamblea en una sola plataforma",
                "All your assembly controls in one platform"
              )}
            </p>
            <div className="mt-7 h-px w-72 bg-[#d8b65f]" />
            <p className="mt-5 max-w-[31rem] text-lg leading-8 text-white/82 lg:text-[1.22rem]">
              {t(
                "Registro, votaciones, asistencia y reportes oficiales en tiempo real.",
                "Registration, voting, attendance, and official reports in real time."
              )}
            </p>
          </div>

          <div className="relative z-20 grid gap-4 text-center text-white sm:grid-cols-3">
            <div className="rounded-xl border border-[#d8b65f]/75 bg-[#062f26]/72 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.24)] backdrop-blur-sm">
              <div className="mx-auto mb-4 flex size-[4.85rem] items-center justify-center rounded-full border border-[#d8b65f] text-[#f2d77a]">
                <Gavel className="h-9 w-9" />
              </div>
              <p className="text-lg font-black">{t("Votaciones seguras", "Secure voting")}</p>
              <p className="mt-2 text-sm leading-5 text-white/78">
                {t(
                  "Administre procesos oficiales con resultados instantáneos.",
                  "Manage official processes with instant results."
                )}
              </p>
            </div>
            <div className="rounded-xl border border-[#d8b65f]/75 bg-[#062f26]/72 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.24)] backdrop-blur-sm">
              <div className="mx-auto mb-4 flex size-[4.85rem] items-center justify-center rounded-full border border-[#d8b65f] text-[#f2d77a]">
                <Users className="h-9 w-9" />
              </div>
              <p className="text-lg font-black">{t("Control de participantes", "Participant control")}</p>
              <p className="mt-2 text-sm leading-5 text-white/78">
                {t(
                  "Registro y verificación de asistencia en tiempo real.",
                  "Registration and attendance verification in real time."
                )}
              </p>
            </div>
            <div className="rounded-xl border border-[#d8b65f]/75 bg-[#062f26]/72 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.24)] backdrop-blur-sm">
              <div className="mx-auto mb-4 flex size-[4.85rem] items-center justify-center rounded-full border border-[#d8b65f] text-[#f2d77a]">
                <FileText className="h-9 w-9" />
              </div>
              <p className="text-lg font-black">{t("Reportes automáticos", "Automatic reports")}</p>
              <p className="mt-2 text-sm leading-5 text-white/78">
                {t(
                  "Actas y resultados listos para descargar y archivar.",
                  "Minutes and results ready to download and archive."
                )}
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-5 py-10 sm:px-10 lg:px-[6vw]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(215,178,87,0.18),transparent_22%),radial-gradient(circle_at_85%_70%,rgba(6,47,38,0.08),transparent_26%)]" />
          <div className="absolute right-0 top-0 h-full w-full opacity-35 [background-image:radial-gradient(#d7b257_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="absolute bottom-[-18%] right-[-10%] h-[62%] w-[70%] rounded-[50%] border border-[#d7b257]/18" />
          <div className="absolute bottom-[-24%] right-[-18%] h-[70%] w-[84%] rounded-[50%] border border-[#d7b257]/14" />

          <div className="relative w-full max-w-[56rem] rounded-xl border border-[#dbc891] bg-white/96 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10">
            <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-[#d7b257]" />

            <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex gap-4">
                <Shield className="mt-1 h-8 w-8 text-[#9c7620]" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#9c7620]">
                    {t("Acceso seguro", "Secure access")}
                  </p>
                  <h2 className="mt-2 text-4xl font-black tracking-tight text-[#123b31]">
                    {t("Selecciona tu área", "Select your area")}
                  </h2>
                </div>
              </div>
              <div className="flex flex-col items-start gap-3 sm:items-end">
                <LanguageToggle />
                <Image
                  src="/KTG_Logo.png"
                  alt="Logo Kingdom Tech Group"
                  width={190}
                  height={92}
                  className="h-16 w-44 object-contain object-right"
                />
              </div>
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
                          {t(item.labelEs, item.labelEn)}
                        </span>
                        <span
                          className={[
                            "mt-2 block text-base leading-6",
                            activo ? "text-white/82" : "text-slate-600",
                          ].join(" ")}
                        >
                          {t(item.descriptionEs, item.descriptionEn)}
                        </span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-base font-bold text-slate-800" htmlFor="organizacion">
                  {t("Organización", "Organization")}
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <select
                    id="organizacion"
                    value={organizacionSlug}
                    onChange={(e) => {
                      setOrganizacionSlug(e.target.value)
                      localStorage.setItem("organizacion_slug", e.target.value)
                    }}
                    className="h-14 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-10 text-base font-semibold text-slate-800 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
                  >
                    {organizaciones.length === 0 ? (
                      <option value="">{t("Cargando organizaciones...", "Loading organizations...")}</option>
                    ) : (
                      organizaciones.map((organizacion) => (
                        <option key={organizacion.id} value={organizacion.slug}>
                          {organizacion.nombre}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {rol !== "asambleista" && (
                <div className="space-y-2">
                  <label className="text-base font-bold text-slate-800" htmlFor="username">
                    {t("Usuario", "Username")}
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="username"
                      type="text"
                      placeholder={t("Ingresa tu usuario", "Enter your username")}
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
                  {t("Contraseña", "Password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={
                      rol === "asambleista"
                        ? t(
                            "Los asambleístas entran con credencial en la próxima pantalla",
                            "Assembly members enter with their credential on the next screen"
                          )
                        : t("Ingresa tu contraseña", "Enter your password")
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
                  ? t("Verificando...", "Verifying...")
                  : rol === "asambleista"
                  ? t("Continuar como Asambleísta", "Continue as Assembly Member")
                  : `${t("Entrar como", "Enter as")} ${t(rolSeleccionado.labelEs, rolSeleccionado.labelEn)}`}
              </span>
              {!cargando && <ArrowRight className="ml-3 h-6 w-6 text-[#f2d77a]" />}
            </Button>

            <div className="mt-7 flex items-center gap-4 text-center text-sm text-slate-500">
              <div className="h-px flex-1 bg-slate-200" />
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span>{t("Sesión protegida por rol y usuario", "Session protected by role and user")}</span>
              </div>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
