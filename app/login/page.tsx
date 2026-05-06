"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [cargando, setCargando] = useState(false)

  // Bug #7 corregido: la contraseña se valida en el servidor, no en el cliente
  const login = async () => {
    if (!password) return
    setCargando(true)

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })

    setCargando(false)

    if (!res.ok) {
      alert("Acceso denegado")
      return
    }

    router.push("/")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") login()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Acceso del Moderador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button className="w-full" onClick={login} disabled={cargando}>
            {cargando ? "Verificando..." : "Entrar"}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}