"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type Asamblea = {
  id: string
  anio: number
  lugar: string
  estado: string
}

export default function Historial() {
  const [asambleas, setAsambleas] = useState<Asamblea[]>([])

  const cargarAsambleas = async () => {
    const { data, error } = await supabase
      .from("asambleas")
      .select("*")
      .order("anio", { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    setAsambleas(data || [])
  }

  useEffect(() => {
    cargarAsambleas()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Historial de Asambleas</h1>

      <div className="space-y-4">
        {asambleas.length === 0 ? (
          <p>No hay asambleas registradas todavía.</p>
        ) : (
          asambleas.map((a) => (
            <div
                key={a.id}
                onClick={() => window.location.href = `/historial/${a.id}`}
                className="p-4 bg-white rounded-lg border cursor-pointer hover:bg-slate-100"
                >
              <p className="font-bold text-lg">
                {a.anio} - {a.lugar}
              </p>

              <p>
                Estado:{" "}
                <span
                  className={
                    a.estado === "abierta"
                      ? "text-green-600 font-bold"
                      : "text-red-600 font-bold"
                  }
                >
                  {a.estado}
                </span>
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}