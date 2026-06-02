"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, History, LogOut, Vote } from "lucide-react"

export default function AsambleistaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  const logout = () => {
    localStorage.removeItem("token_votacion")
    localStorage.removeItem("asambleista_id")
    localStorage.removeItem("asambleista_nombre")
    router.push("/login")
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-[#f4f6f1]">
      {children}

      <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="grid grid-cols-4 text-center">
          <Link
            href="/asambleista"
            className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-bold ${
              pathname === "/asambleista" ? "bg-[#e9f3ef] text-[#16382f]" : "text-slate-500"
            }`}
          >
            <Vote className="h-6 w-6" />
            <span>Votar</span>
          </Link>

          <Link
            href="/asambleista/resultados"
            className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-bold ${
              pathname === "/asambleista/resultados" ? "bg-[#e9f3ef] text-[#16382f]" : "text-slate-500"
            }`}
          >
            <BarChart3 className="h-6 w-6" />
            <span>Resultados</span>
          </Link>

          <Link
            href="/asambleista/historial"
            className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-bold ${
              pathname === "/asambleista/historial" ? "bg-[#e9f3ef] text-[#16382f]" : "text-slate-500"
            }`}
          >
            <History className="h-6 w-6" />
            <span>Historial</span>
          </Link>

          <button onClick={logout} className="flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-bold text-red-600">
            <LogOut className="h-6 w-6" />
            <span>Salir</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
