"use client"

import { useCallback, useEffect, useState } from "react"
import { FileText } from "lucide-react"
import { useI18n } from "@/lib/i18n"

type Informe = {
  id: string
  tipo: string
  nombre_archivo: string
  tamano_bytes: number | null
  subido_por: string | null
  creado_en: string
  url: string | null
}

const tiposInforme: Record<string, string> = {
  presidente: "Presidente",
  secretario: "Secretario",
  tesorero: "Tesorero",
  misiones: "Misiones",
  otros: "Otros informes",
}

function formatearTamano(bytes: number | null) {
  if (!bytes) return "N/A"
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function DocumentosAsambleistaPage() {
  const { t } = useI18n()
  const [informes, setInformes] = useState<Informe[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")

  const cargarInformes = useCallback(async () => {
    setCargando(true)
    setError("")

    const token = localStorage.getItem("token_votacion") || ""

    if (!token) {
      setInformes([])
      setCargando(false)
      setError(
        t(
          "Debes hacer check-in para ver los informes de la asamblea.",
          "You must check in to view assembly reports."
        )
      )
      return
    }

    const res = await fetch(`/api/documentos/informes?token=${encodeURIComponent(token)}`)
    const data = await res.json().catch(() => null)

    setCargando(false)

    if (!res.ok || !data?.ok) {
      setInformes([])
      setError(data?.error || t("No se pudieron cargar los informes", "Could not load reports"))
      return
    }

    setInformes(data.informes || [])
  }, [t])

  useEffect(() => {
    queueMicrotask(() => {
      void cargarInformes()
    })
  }, [cargarInformes])

  return (
    <main className="flex min-h-screen justify-center bg-[#f4f6f1] px-4 py-5 pb-28">
      <div className="w-full max-w-md space-y-4">
        <header className="rounded-2xl bg-[#16382f] p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7c27a]">
            {t("Documentos", "Documents")}
          </p>
          <h1 className="mt-2 text-2xl font-black">
            {t("Informes de asamblea", "Assembly reports")}
          </h1>
          <p className="mt-2 text-sm text-white/70">
            {t(
              "Consulta los informes oficiales compartidos para la asamblea actual.",
              "View official reports shared for the current assembly."
            )}
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                {t("Informes disponibles", "Available reports")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("Solo lectura para asambleístas.", "Read-only for assembly members.")}
              </p>
            </div>
            <button
              type="button"
              onClick={cargarInformes}
              disabled={cargando}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#16382f] shadow-sm disabled:opacity-40"
            >
              {t("Actualizar", "Refresh")}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {cargando ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                {t("Cargando informes...", "Loading reports...")}
              </p>
            ) : error ? (
              <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
                {error}
              </p>
            ) : informes.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                {t(
                  "No hay informes subidos para la asamblea actual.",
                  "No reports have been uploaded for the current assembly."
                )}
              </p>
            ) : (
              informes.map((informe) => (
                <article
                  key={informe.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e9f3ef] text-[#16382f]">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-wide text-[#6f5b1d]">
                        {tiposInforme[informe.tipo] || informe.tipo}
                      </p>
                      <p className="mt-1 break-words font-black text-slate-950">
                        {informe.nombre_archivo}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {formatearTamano(informe.tamano_bytes)} ·{" "}
                        {new Date(informe.creado_en).toLocaleDateString()}
                      </p>
                      {informe.url && (
                        <a
                          href={informe.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex rounded-lg bg-[#16382f] px-4 py-2 text-sm font-bold text-white shadow-sm"
                        >
                          {t("Abrir informe", "Open report")}
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
