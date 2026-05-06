"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Vote, History, LogOut } from "lucide-react"

export default function AsambleistaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  const logout = () => {
    localStorage.removeItem("token_votacion")
    router.push("/asambleista")
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {children}

      <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-white p-4 shadow-2xl">
        <div className="grid grid-cols-3 text-center">
          <Link href="/asambleista" className="flex flex-col items-center text-indigo-600">
            <Vote className="h-6 w-6" />
            <span className="text-xs font-semibold">Votar</span>
          </Link>

          <Link href="/asambleista/resultados" className="flex flex-col items-center text-slate-500">
            <History className="h-6 w-6" />
            <span className="text-xs font-semibold">Resultados</span>
          </Link>

          <button onClick={logout} className="flex flex-col items-center text-red-500">
            <LogOut className="h-6 w-6" />
            <span className="text-xs font-semibold">Salir</span>
          </button>
        </div>
      </nav>
    </div>
  )
}