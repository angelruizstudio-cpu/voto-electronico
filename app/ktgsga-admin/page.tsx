"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Building2,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  User,
} from "lucide-react"
import { LanguageToggle } from "@/components/LanguageToggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/lib/i18n"

export default function SystemOwnerLoginPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [cargando, setCargando] = useState(false)

  const login = async () => {
    if (!username || !password) return

    setCargando(true)

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, rol: "owner" }),
    })

    setCargando(false)

    if (!res.ok) {
      alert(t("Acceso denegado", "Access denied"))
      return
    }

    router.push("/sistema")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") login()
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4efe5] px-5 py-10 text-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(6,61,49,0.12),transparent_26%),radial-gradient(circle_at_86%_80%,rgba(215,178,87,0.18),transparent_30%)]" />
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(#d7b257_1px,transparent_1px)] [background-size:18px_18px]" />

      <section className="relative w-full max-w-[54rem] rounded-xl border border-[#dbc891] bg-white/96 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] sm:p-9">
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-[#d7b257]" />

        <div className="mb-7 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-[#d7b257] bg-[#063d31] text-[#f2d77a]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#9c7620]">
                {t("Acceso privado", "Private access")}
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-[#123b31]">
                {t("Panel del dueño", "System owner panel")}
              </h1>
              <p className="mt-2 max-w-[34rem] text-base leading-7 text-slate-600">
                {t(
                  "Entrada exclusiva para Kingdom Tech Group administrar organizaciones cliente, accesos iniciales y estado de la plataforma.",
                  "Exclusive entry for Kingdom Tech Group to manage client organizations, initial access, and platform status."
                )}
              </p>
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

        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-xl border border-[#d7b257]/65 bg-[#063d31] p-6 text-white shadow-[0_18px_38px_rgba(6,61,49,0.24)]">
            <div className="mb-5 flex size-16 items-center justify-center rounded-full border border-[#d7b257] bg-white/8 text-[#f2d77a]">
              <Building2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black">{t("Dueño del sistema", "System owner")}</h2>
            <p className="mt-3 text-base leading-7 text-white/80">
              {t(
                "Este acceso queda separado de los usuarios de cada organización para proteger el flujo operativo de las asambleas.",
                "This access stays separate from each organization's users to protect the assembly operating flow."
              )}
            </p>
            <div className="mt-6 flex items-center gap-3 border-t border-white/15 pt-5 text-sm text-white/70">
              <KeyRound className="h-5 w-5 text-[#f2d77a]" />
              <span>{t("Credenciales definidas por variables de ambiente", "Credentials defined by environment variables")}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-5">
              <div className="space-y-2">
                <label className="text-base font-bold text-slate-800" htmlFor="username">
                  {t("Usuario", "Username")}
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    placeholder={t("Ingresa tu usuario de dueño", "Enter owner username")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-14 rounded-lg border-slate-200 bg-white pl-12 text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-base font-bold text-slate-800" htmlFor="password">
                  {t("Contraseña", "Password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder={t("Ingresa tu contraseña temporal", "Enter temporary password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-14 rounded-lg border-slate-200 bg-white pl-12 pr-12 text-base"
                  />
                  <EyeOff className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <Button
                className="h-16 w-full rounded-lg border border-[#d7b257] bg-[#063d31] text-xl font-black text-white shadow-[0_18px_40px_rgba(6,61,49,0.22)] hover:bg-[#042d24]"
                onClick={login}
                disabled={cargando}
              >
                <span>{cargando ? t("Verificando...", "Verifying...") : t("Entrar al panel", "Enter panel")}</span>
                {!cargando && <ArrowRight className="ml-3 h-6 w-6 text-[#f2d77a]" />}
              </Button>
            </div>

            <div className="mt-6 flex items-center gap-4 text-center text-sm text-slate-500">
              <div className="h-px flex-1 bg-slate-200" />
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span>{t("Ruta privada de Kingdom Tech Group", "Kingdom Tech Group private route")}</span>
              </div>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
