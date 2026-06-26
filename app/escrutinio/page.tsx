"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, ClipboardList, Edit3, Send, Scale } from "lucide-react"
import {
  ResultadoManualActualizado,
  ResultadoOficialActualizado,
  VotosManualesPanel,
} from "@/components/VotosManualesPanel"
import { Button } from "@/components/ui/button"
import { useAsamblea } from "@/hooks/useAsamblea"
import { useVotacion } from "@/hooks/useVotacion"

function ResultadoParaLectura({ resultado }: { resultado: ResultadoManualActualizado }) {
  if (resultado.tipo === "resolucion") {
    const aprobada = resultado.resultado === "aprobada"

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6f5b1d]">
          Lectura para presidencia
        </p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">{resultado.titulo}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Votos emitidos</p>
            <p className="mt-1 text-3xl font-black text-slate-950">{resultado.emitidos}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Votos necesarios</p>
            <p className="mt-1 text-3xl font-black text-slate-950">{resultado.necesarios}</p>
          </div>
          <div
            className={[
              "rounded-lg p-4",
              aprobada ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800",
            ].join(" ")}
          >
            <p className="text-xs font-bold uppercase">Resultado</p>
            <p className="mt-1 text-xl font-black">
              {aprobada ? "Resolución aprobada" : "Resolución rechazada"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Votos válidos</p>
            <p className="mt-1 text-3xl font-black text-slate-950">{resultado.validos}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <p className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 font-black text-emerald-800">
            A favor: {resultado.favor}
          </p>
          <p className="rounded-lg border border-red-100 bg-red-50 p-4 font-black text-red-800">
            En contra: {resultado.contra}
          </p>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 font-black text-slate-700">
            Abstención: {resultado.abstencion}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6f5b1d]">
        Lectura para presidencia
      </p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">{resultado.titulo}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Votos emitidos</p>
          <p className="mt-1 text-3xl font-black text-slate-950">{resultado.emitidos}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Votos necesarios</p>
          <p className="mt-1 text-3xl font-black text-slate-950">{resultado.necesarios}</p>
        </div>
        <div
          className={[
            "rounded-lg p-4",
            resultado.ganadorNombre ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900",
          ].join(" ")}
        >
          <p className="text-xs font-bold uppercase">Resultado</p>
          <p className="mt-1 text-xl font-black">
            {resultado.ganadorNombre ? "Hubo elección" : "No hubo elección"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Ronda</p>
          <p className="mt-1 text-3xl font-black text-slate-950">{resultado.rondaNumero}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {resultado.candidatos.map((candidato) => (
          <div
            key={candidato.id}
            className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div>
              <p className="font-black text-slate-950">{candidato.nombre}</p>
              <p className="text-xs font-semibold text-slate-500">
                {candidato.electronicos} electrónicos + {candidato.manuales} manuales
              </p>
            </div>
            <p className="text-xl font-black text-[#16382f]">{candidato.votos}</p>
          </div>
        ))}
      </div>

      {(resultado.nulas > 0 || resultado.danadas > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <p className="rounded-lg border border-amber-100 bg-amber-50 p-4 font-black text-amber-900">
            Balotas nulas: {resultado.nulas}
          </p>
          <p className="rounded-lg border border-amber-100 bg-amber-50 p-4 font-black text-amber-900">
            Balotas dañadas: {resultado.danadas}
          </p>
        </div>
      )}

      <p className="mt-4 rounded-lg bg-slate-50 p-4 text-base font-black text-slate-950">
        {resultado.ganadorNombre
          ? `${resultado.ganadorNombre} obtuvo los votos necesarios y queda electo.`
          : "No hubo elección; corresponde continuar con el procedimiento aprobado para la siguiente ronda."}
      </p>
    </div>
  )
}

export default function EscrutinioPage() {
  const { asambleaId, anioAsamblea, lugarAsamblea, organizacionAsamblea, estadoAsamblea } =
    useAsamblea()
  const [resultado, setResultado] = useState<ResultadoManualActualizado | null>(null)
  const [certificado, setCertificado] = useState(false)
  const [certificando, setCertificando] = useState(false)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [votacionPreferidaId, setVotacionPreferidaId] = useState<string | null>(null)
  const ultimaVotacionAbiertaRef = useRef<string | null>(null)
  const modoEdicionRef = useRef(false)
  const { votacionId: votacionActivaId } = useVotacion(asambleaId)

  useEffect(() => {
    modoEdicionRef.current = modoEdicion
  }, [modoEdicion])

  const verificarNuevaVotacionCerrada = useCallback(async () => {
    if (!asambleaId || !resultado) return

    const res = await fetch(`/api/votos-manuales?asambleaId=${encodeURIComponent(asambleaId)}`)
    const data = await res.json().catch(() => null)

    if (!res.ok || !data?.ok) return
    if (modoEdicionRef.current) return

    const votacionCerradaMasReciente = data.votaciones?.[0]

    if (
      votacionCerradaMasReciente?.id &&
      votacionCerradaMasReciente.id !== resultado.votacionId
    ) {
      setResultado(null)
      setCertificado(false)
      setModoEdicion(false)
    }
  }, [asambleaId, resultado])

  useEffect(() => {
    if (!resultado) return

    const intervalo = window.setInterval(() => {
      void verificarNuevaVotacionCerrada()
    }, 3000)

    return () => {
      window.clearInterval(intervalo)
    }
  }, [resultado, verificarNuevaVotacionCerrada])

  useEffect(() => {
    queueMicrotask(() => {
      setResultado(null)
      setCertificado(false)
      setModoEdicion(false)
      setVotacionPreferidaId(null)
      ultimaVotacionAbiertaRef.current = null
    })
  }, [asambleaId])

  useEffect(() => {
    if (!votacionActivaId) return

    ultimaVotacionAbiertaRef.current = votacionActivaId
    queueMicrotask(() => {
      if (modoEdicionRef.current) return

      setVotacionPreferidaId(votacionActivaId)

      if (resultado && resultado.votacionId !== votacionActivaId) {
        setResultado(null)
        setCertificado(false)
        setModoEdicion(false)
      }
    })
  }, [resultado, votacionActivaId])

  const certificarResultado = async () => {
    if (!resultado) return

    setCertificando(true)

    const res = await fetch("/api/escrutinio/certificaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ votacionId: resultado.votacionId, resultado }),
    })
    const data = await res.json().catch(() => null)

    setCertificando(false)

    if (!res.ok || !data?.ok) {
      alert(data?.error || "No se pudo certificar el resultado")
      return
    }

    setCertificado(true)
    setModoEdicion(false)
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#6f5b1d]">
              Comité de Escrutinio
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Votos manuales y resultado oficial</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600">
              El comité registra las balotas manuales de una votación cerrada y prepara el resultado
              oficial para presentarlo al presidente de la asamblea.
            </p>
          </div>
          <div className="rounded-lg border border-[#d9dfd3] bg-[#f8f9f5] p-4 text-sm">
            <p className="font-black text-slate-950">
              {organizacionAsamblea || "Sin organización seleccionada"}
            </p>
            <p className="mt-1 text-slate-600">
              Asamblea {anioAsamblea || "—"} · {lugarAsamblea || "—"}
            </p>
            <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">
              {asambleaId ? (estadoAsamblea === "receso" ? "En receso" : "Activa") : "Sin asamblea activa"}
            </p>
          </div>
        </div>
      </section>

      {!asambleaId ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-start gap-3">
            <Scale className="mt-1 h-5 w-5 shrink-0" />
            <div>
              <h2 className="text-lg font-black">No hay asamblea activa</h2>
              <p className="mt-1 text-sm font-semibold">
                Primero abre o selecciona una asamblea para que el comité pueda registrar votos manuales.
              </p>
            </div>
          </div>
        </section>
      ) : resultado ? (
        <section className="space-y-4">
          {certificado && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="font-black">Resultado certificado y listo para el moderador.</p>
            </div>
          )}

          <ResultadoParaLectura resultado={resultado} />
          <ResultadoOficialActualizado resultado={resultado} />

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setVotacionPreferidaId(resultado.votacionId)
                setResultado(null)
                setCertificado(false)
                setModoEdicion(true)
              }}
              className="h-11 gap-2"
            >
              <Edit3 className="h-4 w-4" />
              Editar votos manuales
            </Button>
            <Button
              type="button"
              onClick={certificarResultado}
              disabled={certificando}
              className="h-11 gap-2 bg-[#16382f] px-4 hover:bg-[#0f2b24]"
            >
              <Send className="h-4 w-4" />
              {certificando ? "Certificando..." : "Certificar y enviar resultado"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <ClipboardList className="mt-1 h-5 w-5 shrink-0 text-[#6f5b1d]" />
              <div>
                <h2 className="font-black text-slate-950">Flujo del comité</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Selecciona una votación cerrada, registra votos manuales, balotas nulas o dañadas,
                  y guarda. Luego esta pantalla mostrará el resultado listo para lectura.
                </p>
              </div>
            </div>
          </div>

          <VotosManualesPanel
            asambleaId={asambleaId}
            notificarResultadoGuardadoAlCargar={!modoEdicion}
            votacionPreferidaId={votacionPreferidaId}
            onResultadosActualizados={(resultadoActualizado) => {
              setResultado(resultadoActualizado)
              setCertificado(false)
              setModoEdicion(false)
            }}
          />
        </section>
      )}
    </main>
  )
}
