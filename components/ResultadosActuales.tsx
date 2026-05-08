"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAsamblea } from "@/hooks/useAsamblea"
import { useVotacion } from "@/hooks/useVotacion"
import {
  calcularNecesarios,
  mostrarTipoMayoria,
  mostrarTipoMocion,
  mostrarTipoVotacion,
} from "@/lib/votacionHelpers"

export function ResultadosActuales() {
  const { asambleaId, anioAsamblea, lugarAsamblea, organizacionAsamblea } = useAsamblea()
  const {
    estado,
    titulo,
    tipoMayoria,
    tipoVotacion,
    tipoMocion,
    rondaNumero,
    votosEmitidos,
    votosAFavor,
    votosEnContra,
    conteoCandidatos,
  } = useVotacion(asambleaId)

  const totalValidos = votosAFavor + votosEnContra
  const necesarios = calcularNecesarios(
    tipoVotacion === "eleccion_lideres" ? votosEmitidos : totalValidos,
    tipoVotacion === "eleccion_lideres" ? "mayoria_simple" : tipoMayoria
  )
  const candidatosOrdenados = conteoCandidatos
    .slice()
    .sort((a, b) => b.votos - a.votos)

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Resultados de la asamblea actual</h1>
          <p className="text-slate-600">
            {asambleaId
              ? `${organizacionAsamblea || "Organización no especificada"} · Asamblea ${anioAsamblea} · ${lugarAsamblea}`
              : "No hay asamblea activa"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{titulo || "No hay votación activa"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-slate-500">Estado</p>
                <p className="text-xl font-bold capitalize">{estado}</p>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-slate-500">Tipo</p>
                <p className="text-xl font-bold">{mostrarTipoVotacion(tipoVotacion)}</p>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-slate-500">Votos emitidos</p>
                <p className="text-xl font-bold">{votosEmitidos}</p>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-sm text-slate-500">Votos necesarios</p>
                <p className="text-xl font-bold">{necesarios}</p>
              </div>
            </div>

            {tipoVotacion === "resolucion" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Moción</p>
                  <p className="font-bold">{mostrarTipoMocion(tipoMocion)}</p>
                  <p className="text-sm text-slate-500">
                    {mostrarTipoMayoria(tipoMayoria)}
                  </p>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm text-green-700">A favor</p>
                  <p className="text-3xl font-black text-green-800">{votosAFavor}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-700">En contra</p>
                  <p className="text-3xl font-black text-red-800">{votosEnContra}</p>
                </div>
              </div>
            )}

            {tipoVotacion === "eleccion_lideres" && (
              <div className="space-y-3">
                <p className="font-semibold">Ronda {rondaNumero}</p>
                {candidatosOrdenados.length === 0 ? (
                  <p className="text-slate-500">No hay candidatos registrados.</p>
                ) : (
                  candidatosOrdenados.map((candidato, index) => (
                    <div
                      key={candidato.id}
                      className="grid grid-cols-[80px_1fr_100px_100px] items-center rounded-lg border bg-white p-3"
                    >
                      <p className="font-bold">#{index + 1}</p>
                      <p className="font-semibold">{candidato.nombre}</p>
                      <p>{candidato.votos} votos</p>
                      <p>{candidato.porcentaje}%</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
