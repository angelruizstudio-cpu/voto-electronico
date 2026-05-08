"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"

type Asambleista = {
  id: string
  nombre: string
  credencial: string
  iglesia: string | null
  distrito: string | null
  registrado: boolean
  pago_confirmado: boolean
  habilitado: boolean
  presente: boolean
}

export default function PuertaPage() {
  const [asambleistas, setAsambleistas] = useState<Asambleista[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [cargando, setCargando] = useState(false)

  const cargarAsambleistas = useCallback(async () => {
    const res = await fetch("/api/oficina/asambleistas")
    const data = await res.json()

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudo cargar la lista")
      return
    }

    setAsambleistas(data.asambleistas || [])
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarAsambleistas()
    })
  }, [cargarAsambleistas])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return asambleistas

    return asambleistas.filter((a) =>
      [a.nombre, a.credencial, a.iglesia || "", a.distrito || ""]
        .join(" ")
        .toLowerCase()
        .includes(texto)
    )
  }, [asambleistas, busqueda])

  const actualizarPresencia = async (id: string, presente: boolean) => {
    setCargando(true)

    const res = await fetch("/api/oficina/asambleistas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, cambios: { presente } }),
    })
    const data = await res.json()

    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudo actualizar la presencia")
      return
    }

    await cargarAsambleistas()
  }

  return (
    <main className="min-h-screen min-w-[1100px] bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <h1 className="text-3xl font-bold">Puerta: check-in y check-out</h1>
          <p className="text-slate-600">
            Pantalla para el equipo que controla entrada y salida.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
          <Search className="h-5 w-5 text-slate-500" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, credencial, iglesia o distrito"
            className="w-full outline-none"
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Registrados</p>
            <p className="text-3xl font-black">{asambleistas.length}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Presentes</p>
            <p className="text-3xl font-black text-green-700">
              {asambleistas.filter((a) => a.presente).length}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Fuera</p>
            <p className="text-3xl font-black text-red-700">
              {asambleistas.filter((a) => !a.presente).length}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Habilitados</p>
            <p className="text-3xl font-black">
              {asambleistas.filter((a) => a.habilitado).length}
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-white shadow-sm">
          {visibles.length === 0 ? (
            <p className="p-6 text-slate-500">No hay registros para mostrar.</p>
          ) : (
            visibles.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[1fr_180px_170px] items-center gap-4 border-b p-4 last:border-b-0"
              >
                <div>
                  <p className="text-lg font-bold">{a.nombre}</p>
                  <p className="text-sm text-slate-500">
                    {a.credencial} · {a.iglesia || "N/A"} · {a.distrito || "N/A"}
                  </p>
                  <p className="mt-1 text-sm">
                    <span
                      className={
                        a.presente
                          ? "font-bold text-green-700"
                          : "font-bold text-red-700"
                      }
                    >
                      {a.presente ? "Presente" : "Fuera"}
                    </span>
                    {" · "}
                    {a.habilitado ? "Habilitado" : "No habilitado"}
                  </p>
                </div>

                <Button
                  disabled={cargando || a.presente || !a.habilitado}
                  onClick={() => actualizarPresencia(a.id, true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Check-in
                </Button>

                <Button
                  disabled={cargando || !a.presente}
                  onClick={() => actualizarPresencia(a.id, false)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Check-out
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
