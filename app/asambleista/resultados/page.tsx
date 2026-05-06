"use client"

import { useAsamblea } from "@/hooks/useAsamblea"
import { useVotacion } from "@/hooks/useVotacion"
import { calcularNecesarios, mostrarTipoMayoria, mostrarTipoVotacion } from "@/lib/votacionHelpers"
import { Check, X } from "lucide-react"

export default function ResultadosPage() {
  const { asambleaId } = useAsamblea()
  const {
    publicada,
    titulo,
    tipoVotacion,
    tipoMayoria,
    votosEmitidos,
    votosAFavor,
    votosEnContra,
    conteoCandidatos,
  } = useVotacion(asambleaId)

  // Bug #10 corregido: página muestra datos reales cuando están publicados
  if (!publicada) {
    return (
      <div className="p-6 text-center">
        <p className="text-lg font-semibold text-slate-600">
          Los resultados aún no han sido publicados.
        </p>
      </div>
    )
  }

  const totalValidos = votosAFavor + votosEnContra
  const necesarios = calcularNecesarios(totalValidos, tipoMayoria)
  const aprobado = votosAFavor >= necesarios && totalValidos > 0

  return (
    <div className="p-6 space-y-6 pb-24">
      <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>

      <p className="text-slate-500 text-sm">
        {mostrarTipoVotacion(tipoVotacion)} · {mostrarTipoMayoria(tipoMayoria)}
      </p>

      {tipoVotacion === "resolucion" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-3xl font-extrabold text-green-700">{votosAFavor}</p>
              <p className="text-sm font-semibold text-green-600 mt-1">A favor</p>
            </div>
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-center">
              <p className="text-3xl font-extrabold text-red-700">{votosEnContra}</p>
              <p className="text-sm font-semibold text-red-600 mt-1">En contra</p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border p-4 space-y-1 text-sm text-slate-600">
            <p>Votos emitidos: <span className="font-semibold">{votosEmitidos}</span></p>
            <p>Votos necesarios: <span className="font-semibold">{necesarios}</span></p>
          </div>

          <div className={`rounded-2xl p-5 flex items-center gap-3 ${
            aprobado ? "bg-green-100 border border-green-300" : "bg-red-100 border border-red-300"
          }`}>
            {aprobado
              ? <Check className="h-8 w-8 text-green-700" />
              : <X className="h-8 w-8 text-red-700" />
            }
            <p className={`text-2xl font-extrabold ${aprobado ? "text-green-700" : "text-red-700"}`}>
              {aprobado ? "APROBADO" : "NO APROBADO"}
            </p>
          </div>
        </div>
      )}

      {tipoVotacion === "eleccion_lideres" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Votos emitidos: {votosEmitidos}</p>
          {conteoCandidatos
            .slice()
            .sort((a, b) => b.votos - a.votos)
            .map((c, index) => (
              <div
                key={c.id}
                className={`rounded-2xl border p-4 flex items-center justify-between ${
                  index === 0 ? "bg-green-50 border-green-300" : "bg-white"
                }`}
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {index === 0 && "🏆 "}{c.nombre}
                  </p>
                  <p className="text-sm text-slate-500">{c.porcentaje}% de los votos</p>
                </div>
                <p className="text-2xl font-extrabold text-slate-700">{c.votos}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}