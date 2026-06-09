"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { FileText, History, Upload } from "lucide-react"
import { HistorialAsambleas } from "@/components/HistorialAsambleas"

type Informe = {
  id: string
  tipo: string
  nombre_archivo: string
  tamano_bytes: number | null
  subido_por: string | null
  creado_en: string
  url: string | null
}

const tiposInforme = [
  { value: "presidente", label: "Presidente" },
  { value: "secretario", label: "Secretario" },
  { value: "tesorero", label: "Tesorero" },
  { value: "misiones", label: "Misiones" },
  { value: "otros", label: "Otros informes" },
]

function formatearTamano(bytes: number | null) {
  if (!bytes) return "N/A"
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function DocumentosPage() {
  const [tab, setTab] = useState<"historial" | "informes">("historial")
  const [tipo, setTipo] = useState("presidente")
  const [archivo, setArchivo] = useState<File | null>(null)
  const [informes, setInformes] = useState<Informe[]>([])
  const [cargando, setCargando] = useState(false)

  const cargarInformes = useCallback(async () => {
    const res = await fetch("/api/documentos/informes")
    const data = await res.json().catch(() => null)

    if (!res.ok || !data?.ok) {
      alert(data?.error || "No se pudieron cargar los informes")
      return
    }

    setInformes(data.informes || [])
  }, [])

  useEffect(() => {
    if (tab === "informes") {
      queueMicrotask(() => {
        void cargarInformes()
      })
    }
  }, [cargarInformes, tab])

  const subirInforme = async () => {
    if (!archivo) {
      alert("Selecciona un archivo")
      return
    }

    setCargando(true)
    const formData = new FormData()
    formData.set("tipo", tipo)
    formData.set("archivo", archivo)

    const res = await fetch("/api/documentos/informes", {
      method: "POST",
      body: formData,
    })
    const data = await res.json().catch(() => null)
    setCargando(false)

    if (!res.ok || !data?.ok) {
      alert(data?.error || "No se pudo subir el informe")
      return
    }

    setArchivo(null)
    await cargarInformes()
    alert("Informe subido")
  }

  return (
    <main className="min-h-screen bg-[#f4f6f1] p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6f5b1d]">
                Documentos
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">
                Archivo de asamblea
              </h1>
              <p className="mt-2 max-w-2xl text-slate-600">
                Histórico de asambleas e informes oficiales de la asamblea actual.
              </p>
            </div>
            <Link
              href="/oficina"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Volver al menú
            </Link>
          </div>
        </header>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTab("historial")}
            className={[
              "flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-black transition",
              tab === "historial"
                ? "bg-[#16382f] text-white"
                : "text-slate-600 hover:bg-slate-50",
            ].join(" ")}
          >
            <History className="h-5 w-5" />
            Histórico de asambleas
          </button>
          <button
            type="button"
            onClick={() => setTab("informes")}
            className={[
              "flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-black transition",
              tab === "informes"
                ? "bg-[#16382f] text-white"
                : "text-slate-600 hover:bg-slate-50",
            ].join(" ")}
          >
            <FileText className="h-5 w-5" />
            Informes de asamblea
          </button>
        </div>

        {tab === "historial" ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <HistorialAsambleas embedded title="Histórico de asambleas" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Subir informe</h2>
              <p className="mt-1 text-sm text-slate-600">
                Selecciona el tipo de informe y adjunta el documento oficial.
              </p>

              <label className="mt-4 block text-sm font-bold text-slate-700">
                Tipo de informe
              </label>
              <select
                value={tipo}
                onChange={(event) => setTipo(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-bold outline-none focus:border-[#c8a957] focus:ring-2 focus:ring-[#c8a957]/20"
              >
                {tiposInforme.map((opcion) => (
                  <option key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </option>
                ))}
              </select>

              <label className="mt-4 block text-sm font-bold text-slate-700">
                Archivo
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
                onChange={(event) => setArchivo(event.target.files?.[0] || null)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
              />

              <button
                type="button"
                onClick={subirInforme}
                disabled={cargando || !archivo}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#16382f] px-4 py-2.5 font-bold text-white transition hover:bg-[#0f2b24] disabled:opacity-40"
              >
                <Upload className="h-4 w-4" />
                {cargando ? "Subiendo..." : "Subir informe"}
              </button>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Informes subidos</h2>
              <div className="mt-4 space-y-3">
                {informes.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 p-4 text-slate-500">
                    No hay informes subidos para la asamblea actual.
                  </p>
                ) : (
                  informes.map((informe) => {
                    const tipoLabel =
                      tiposInforme.find((opcion) => opcion.value === informe.tipo)?.label ||
                      informe.tipo

                    return (
                      <div
                        key={informe.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-[#6f5b1d]">
                              {tipoLabel}
                            </p>
                            <p className="mt-1 font-black text-slate-950">
                              {informe.nombre_archivo}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {formatearTamano(informe.tamano_bytes)} ·{" "}
                              {informe.subido_por || "Usuario"} ·{" "}
                              {new Date(informe.creado_en).toLocaleString()}
                            </p>
                          </div>
                          {informe.url && (
                            <a
                              href={informe.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#16382f] shadow-sm transition hover:bg-slate-100"
                            >
                              Descargar
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
