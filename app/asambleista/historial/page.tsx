"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
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

export default function HistorialAsambleistaPage() {
  const router = useRouter()
  const [asambleas, setAsambleas] = useState<Asamblea[]>([])

  const cargarAsambleas = useCallback(async () => {
    const organizacionSlug =
      typeof window !== "undefined" ? localStorage.getItem("organizacion_slug") : null

    let query = supabase
      .from("asambleas")
      .select("*")
      .order("anio", { ascending: false })

    if (organizacionSlug) {
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
    <main className="min-h-screen bg-[#f4f6f1] px-4 py-6 pb-28">
      <div className="mx-auto max-w-md space-y-4">
        <header className="rounded-2xl bg-[#16382f] p-5 text-white">
          <Image
            src="/logo_voto_electronico.png"
            alt="Logo oficial"
            width={72}
            height={72}
            className="size-14 rounded-lg bg-white object-cover"
          />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#d7c27a]">
            Consulta
          </p>
          <h1 className="mt-2 text-2xl font-black">Historial</h1>
          <p className="mt-2 text-sm text-white/70">Asambleas pasadas y actuales.</p>
        </header>

        {asambleas.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-slate-500">No hay asambleas registradas todavía.</p>
          </div>
        ) : (
          asambleas.map((asamblea) => (
            <button
              key={asamblea.id}
              type="button"
              onClick={() => router.push(`/historial/${asamblea.id}`)}
              className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#c8a957]"
            >
              <p className="text-lg font-bold text-slate-900">
                Asamblea {asamblea.anio}
              </p>
              <p className="text-sm text-slate-500">{asamblea.lugar}</p>
              <p
                className={
                  asamblea.estado === "abierta"
                    ? "mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700"
                    : "mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600"
                }
              >
                {asamblea.estado === "abierta" ? "Abierta" : "Cerrada"}
              </p>
            </button>
          ))
        )}
      </div>
    </main>
  )
}
