"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { etiquetaRol, ROLES_SISTEMA, type RolSistema } from "@/lib/auth"

type UsuarioSistema = {
  id: string
  nombre: string
  username: string
  roles: RolSistema[]
  activo: boolean
  creado_en: string
}

export default function AdminPage() {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([])
  const [nombre, setNombre] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [roles, setRoles] = useState<RolSistema[]>(["moderador"])
  const [cargando, setCargando] = useState(false)

  const cargarUsuarios = useCallback(async () => {
    const res = await fetch("/api/admin/usuarios")
    const data = await res.json()

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudieron cargar los usuarios")
      return
    }

    setUsuarios(data.usuarios || [])
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarUsuarios()
    })
  }, [cargarUsuarios])

  const toggleRol = (rol: RolSistema) => {
    setRoles((actuales) =>
      actuales.includes(rol)
        ? actuales.filter((item) => item !== rol)
        : [...actuales, rol]
    )
  }

  const crearUsuario = async () => {
    if (!nombre.trim() || !username.trim() || !password.trim() || roles.length === 0) {
      alert("Completa nombre, usuario, contraseña y al menos un rol")
      return
    }

    setCargando(true)
    const res = await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, username, password, roles }),
    })
    const data = await res.json()
    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudo crear el usuario")
      return
    }

    setNombre("")
    setUsername("")
    setPassword("")
    setRoles(["moderador"])
    await cargarUsuarios()
  }

  const cambiarEstado = async (usuario: UsuarioSistema) => {
    setCargando(true)
    const res = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: usuario.id, activo: !usuario.activo }),
    })
    const data = await res.json()
    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudo actualizar el usuario")
      return
    }

    await cargarUsuarios()
  }

  const resetPassword = async (usuario: UsuarioSistema) => {
    const nuevaPassword = window.prompt(
      `Nueva contraseña para ${usuario.nombre}`
    )

    if (!nuevaPassword) return

    setCargando(true)
    const res = await fetch("/api/admin/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: usuario.id, password: nuevaPassword }),
    })
    const data = await res.json()
    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudo cambiar la contraseña")
      return
    }

    alert("Contraseña actualizada")
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Administrador del sistema</h1>
          <p className="text-slate-600">
            Usuarios, contraseñas y acceso por roles.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Crear usuario</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre completo"
              className="rounded border p-2"
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuario"
              className="rounded border p-2"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña inicial"
              type="password"
              className="rounded border p-2"
            />
            <div className="flex flex-wrap gap-2">
              {ROLES_SISTEMA.map((rol) => (
                <button
                  key={rol}
                  type="button"
                  onClick={() => toggleRol(rol)}
                  className={`rounded border px-3 py-2 text-sm font-semibold ${
                    roles.includes(rol)
                      ? "bg-slate-950 text-white"
                      : "bg-white text-slate-700"
                  }`}
                >
                  {etiquetaRol(rol)}
                </button>
              ))}
            </div>
            <Button onClick={crearUsuario} disabled={cargando} className="col-span-2">
              Crear usuario
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usuarios del sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {usuarios.length === 0 ? (
              <p className="text-slate-500">No hay usuarios creados.</p>
            ) : (
              usuarios.map((usuario) => (
                <div
                  key={usuario.id}
                  className="grid grid-cols-[1fr_260px_220px] items-center gap-4 rounded border bg-white p-4"
                >
                  <div>
                    <p className="font-bold">{usuario.nombre}</p>
                    <p className="text-sm text-slate-500">@{usuario.username}</p>
                    <p
                      className={
                        usuario.activo
                          ? "text-sm font-semibold text-green-700"
                          : "text-sm font-semibold text-red-700"
                      }
                    >
                      {usuario.activo ? "Activo" : "Inactivo"}
                    </p>
                  </div>
                  <p className="text-sm text-slate-600">
                    {usuario.roles.map(etiquetaRol).join(", ")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => resetPassword(usuario)}
                      disabled={cargando}
                    >
                      Contraseña
                    </Button>
                    <Button
                      type="button"
                      onClick={() => cambiarEstado(usuario)}
                      disabled={cargando}
                    >
                      {usuario.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
