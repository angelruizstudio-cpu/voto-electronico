"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

type Asamblea = {
  id: string
  anio: number
  lugar: string
  estado: string
  organizacion_id?: string | null
  organizacion_slug?: string | null
}

export function HistorialAsambleas() {
  const router = useRouter()
  const [asambleas, setAsambleas] = useState<Asamblea[]>([])

  const cargarAsambleas = useCallback(async () => {
    const res = await fetch("/api/auth/me").catch(() => null)
    const sesion = res?.ok ? await res.json().catch(() => null) : null
    const organizacionId = sesion?.organizacion?.id || null
    const organizacionSlug =
      sesion?.organizacion?.slug ||
      (typeof window !== "undefined" ? localStorage.getItem("organizacion_slug") : null)

    let query = supabase
      .from("asambleas")
      .select("*")
      .order("anio", { ascending: false })

    if (organizacionId) {
      query = query.eq("organizacion_id", organizacionId)
    } else if (organizacionSlug) {
      query = query.eq("organizacion_slug", organizacionSlug)
    }

    const { data, error } = await query

    if (error) {
      console.error(error)
      return
    }

    setAsambleas(data || [])
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarAsambleas()
    })
  }, [cargarAsambleas])

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-3xl font-bold">Historial de Asambleas</h1>

        <div className="space-y-4">
          {asambleas.length === 0 ? (
            <p>No hay asambleas registradas todavía.</p>
          ) : (
            asambleas.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => router.push(`/historial/${a.id}`)}
                className="w-full rounded-lg border bg-white p-4 text-left hover:bg-slate-50"
              >
                <p className="text-lg font-bold">
                  {a.anio} - {a.lugar}
                </p>

                <p>
                  Estado:{" "}
                  <span
                    className={
                      a.estado === "abierta"
                        ? "font-bold text-green-600"
                        : "font-bold text-red-600"
                    }
                  >
                    {a.estado}
                  </span>
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
