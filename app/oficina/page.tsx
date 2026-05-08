"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAsamblea } from "@/hooks/useAsamblea"

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

export default function OficinaRegionalPage() {
  const { asambleaId } = useAsamblea()

  const [asambleistas, setAsambleistas] = useState<Asambleista[]>([])
  const [cargando, setCargando] = useState(false)

  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevaIglesia, setNuevaIglesia] = useState("")
  const [nuevoDistrito, setNuevoDistrito] = useState("")

  const cargarAsambleistas = useCallback(async () => {
    const res = await fetch("/api/oficina/asambleistas")
    const data = await res.json()

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudo cargar la lista de asambleístas")
      return
    }

    setAsambleistas(data.asambleistas || [])
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarAsambleistas()
    })

    const canalAsambleistas = supabase
      .channel("realtime-asambleistas-oficina")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "asambleistas",
        },
        () => {
          cargarAsambleistas()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalAsambleistas)
    }
  }, [cargarAsambleistas])

  const actualizarAsambleista = async (
    id: string,
    cambios: Partial<Asambleista>
  ) => {
    setCargando(true)

    const res = await fetch("/api/oficina/asambleistas", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, cambios }),
    })

    const data = await res.json()

    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudo actualizar el asambleísta")
      return
    }

    await cargarAsambleistas()
  }

  const crearAsambleista = async () => {
    if (!nuevoNombre.trim()) {
      alert("Nombre es requerido")
      return
    }

    if (!asambleaId) {
      alert("Primero debes abrir una asamblea")
      return
    }

    setCargando(true)

    const res = await fetch("/api/oficina/asambleistas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asambleaId,
        nombre: nuevoNombre,
        iglesia: nuevaIglesia,
        distrito: nuevoDistrito,
      }),
    })

    const data = await res.json()

    setCargando(false)

    if (!res.ok || !data.ok) {
      alert(data.error || "No se pudo crear el asambleísta")
      return
    }

    setNuevoNombre("")
    setNuevaIglesia("")
    setNuevoDistrito("")

    await cargarAsambleistas()

    alert(`Asambleísta creado: ${data.asambleista.credencial}`)
  }

  return (
    <main className="min-h-screen bg-[#f4f6f1] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6f5b1d]">
            Oficina regional
          </p>
          <div className="mt-2 flex items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-slate-950">
                Registro de asambleístas
              </h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Confirmación de registro, pago y habilitación antes del acceso a votación.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Total
                </p>
                <p className="text-2xl font-black">{asambleistas.length}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Habilitados
                </p>
                <p className="text-2xl font-black text-emerald-800">
                  {asambleistas.filter((a) => a.habilitado).length}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  Pendientes
                </p>
                <p className="text-2xl font-black text-amber-800">
                  {asambleistas.filter((a) => !a.habilitado).length}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Nuevo asambleísta</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">

          <input
            type="text"
            placeholder="Nombre y apellido"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
          />

          <input
            type="text"
            placeholder="Iglesia"
            value={nuevaIglesia}
            onChange={(e) => setNuevaIglesia(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
          />

          <input
            type="text"
            placeholder="Distrito"
            value={nuevoDistrito}
            onChange={(e) => setNuevoDistrito(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
          />
          </div>

          <button
            onClick={crearAsambleista}
            disabled={cargando}
            className="mt-4 rounded-lg bg-[#16382f] px-4 py-2.5 font-bold text-white transition hover:bg-[#0f2b24] disabled:opacity-40"
          >
            Crear asambleísta
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-black text-slate-950">Lista de asambleístas</h2>
          </div>

          {asambleistas.length === 0 && (
            <p className="p-5 text-slate-500">No hay registros</p>
          )}

          <div>
            {asambleistas.map((a) => (
              <div key={a.id} className="border-b border-slate-100 p-5 last:border-b-0">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-950">{a.nombre}</p>
                    <p className="text-sm text-slate-500">
                      Credencial: {a.credencial}
                    </p>
                    <p className="text-sm text-slate-500">
                      Iglesia: {a.iglesia || "N/A"} | Distrito:{" "}
                      {a.distrito || "N/A"}
                    </p>
                    <p className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                      <span className={a.registrado ? "rounded-full bg-blue-50 px-2 py-1 text-blue-700" : "rounded-full bg-slate-100 px-2 py-1 text-slate-500"}>
                        {a.registrado ? "Registrado" : "Sin registrar"}
                      </span>
                      <span className={a.pago_confirmado ? "rounded-full bg-emerald-50 px-2 py-1 text-emerald-700" : "rounded-full bg-slate-100 px-2 py-1 text-slate-500"}>
                        {a.pago_confirmado ? "Pago confirmado" : "Pago pendiente"}
                      </span>
                      <span className={a.habilitado ? "rounded-full bg-[#e9f3ef] px-2 py-1 text-[#16382f]" : "rounded-full bg-amber-50 px-2 py-1 text-amber-700"}>
                        {a.habilitado ? "Habilitado" : "No habilitado"}
                      </span>
                      <span className={a.presente ? "rounded-full bg-green-50 px-2 py-1 text-green-700" : "rounded-full bg-red-50 px-2 py-1 text-red-700"}>
                        {a.presente ? "Presente" : "Fuera"}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={cargando || a.registrado}
                      onClick={() =>
                        actualizarAsambleista(a.id, { registrado: true })
                      }
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
                    >
                      Registrar
                    </button>

                    <button
                      disabled={cargando || a.pago_confirmado}
                      onClick={() =>
                        actualizarAsambleista(a.id, {
                          pago_confirmado: true,
                        })
                      }
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
                    >
                      Confirmar pago
                    </button>

                    <button
                      disabled={
                        cargando ||
                        a.habilitado ||
                        !a.registrado ||
                        !a.pago_confirmado
                      }
                      onClick={() =>
                        actualizarAsambleista(a.id, {
                          habilitado: true,
                        })
                      }
                      className="rounded-lg bg-[#16382f] px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
                    >
                      Habilitar
                    </button>

                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
