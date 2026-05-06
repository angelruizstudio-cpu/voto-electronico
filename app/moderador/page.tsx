"use client"

import { useAsamblea } from "@/hooks/useAsamblea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCrearVotacion } from "@/hooks/useCrearVotacion"
import { useVotacion } from "@/hooks/useVotacion"
import { supabase } from "@/lib/supabaseClient"

export default function Moderador() {
  const {
    asambleaId,
    anioAsamblea,
    lugarAsamblea,
    nuevoAnio,
    nuevoLugar,
    setNuevoAnio,
    setNuevoLugar,
    abrirAsamblea,
  } = useAsamblea()

  const {
    votacionId,
    titulo,
    tipoVotacion,
    conteoCandidatos,
    votosEmitidos,
    votosAFavor,
    votosEnContra,
    cargarVotacionActiva,
  } = useVotacion(asambleaId)

  const {
    nuevoTitulo,
    setNuevoTitulo,
    nuevoTipoMayoria,
    setNuevoTipoMayoria,
    nuevoTipoVotacion,
    setNuevoTipoVotacion,
    candidatosInput,
    setCandidatosInput,
    crearVotacion,
  } = useCrearVotacion(asambleaId, cargarVotacionActiva)

  const totalValidos = votosAFavor + votosEnContra
  const porcentajeAprobacion =
    totalValidos > 0 ? Math.round((votosAFavor / totalValidos) * 100) : 0

  const cerrarVotacion = async () => {
    if (!votacionId) {
      alert("No hay votación activa")
      return
    }

    const { error } = await supabase
      .from("votaciones")
      .update({ estado: "cerrada" })
      .eq("id", votacionId)

    if (error) {
      alert(error.message)
      return
    }

    alert("Votación cerrada")
    await cargarVotacionActiva()
  }

  const publicarResultados = async () => {
    if (!votacionId) {
      alert("No hay votación para publicar")
      return
    }

    const { error } = await supabase
      .from("votaciones")
      .update({ publicada: true })
      .eq("id", votacionId)

    if (error) {
      alert(error.message)
      return
    }

    alert("Resultados publicados")
    await cargarVotacionActiva()
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Abrir Asamblea</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <input
              type="text"
              placeholder="Año"
              value={nuevoAnio}
              onChange={(e) => setNuevoAnio(e.target.value)}
              className="border p-2 rounded w-full"
            />
            <input
              type="text"
              placeholder="Lugar"
              value={nuevoLugar}
              onChange={(e) => setNuevoLugar(e.target.value)}
              className="border p-2 rounded w-full"
            />
            <Button onClick={abrirAsamblea}>Abrir</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asamblea activa</CardTitle>
          </CardHeader>
          <CardContent>
            {asambleaId ? (
              <>
                <p>Año: {anioAsamblea}</p>
                <p>Lugar: {lugarAsamblea}</p>
              </>
            ) : (
              <p>No hay asamblea activa</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Crear votación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="text"
              placeholder="Título"
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
              className="border p-2 rounded w-full"
            />

            <select
              value={nuevoTipoVotacion}
              onChange={(e) => setNuevoTipoVotacion(e.target.value)}
              className="border p-2 rounded w-full"
            >
              <option value="resolucion">Resolución</option>
              <option value="eleccion_lideres">Elección de líderes</option>
            </select>

            {nuevoTipoVotacion === "resolucion" && (
              <select
                value={nuevoTipoMayoria}
                onChange={(e) => setNuevoTipoMayoria(e.target.value)}
                className="border p-2 rounded w-full"
              >
                <option value="mayoria_simple">Mayoría simple</option>
                <option value="dos_tercios">Dos tercios</option>
              </select>
            )}

            {nuevoTipoVotacion === "eleccion_lideres" && (
              <div className="space-y-2">
                {candidatosInput.map((c, index) => (
                  <input
                    key={index}
                    type="text"
                    placeholder={`Candidato ${index + 1}`}
                    value={c}
                    onChange={(e) => {
                      const nuevos = [...candidatosInput]
                      nuevos[index] = e.target.value
                      setCandidatosInput(nuevos)
                    }}
                    className="border p-2 rounded w-full"
                  />
                ))}

                <Button
                  type="button"
                  onClick={() => setCandidatosInput([...candidatosInput, ""])}
                >
                  + Añadir candidato
                </Button>
              </div>
            )}

            <Button onClick={crearVotacion}>Crear y abrir</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultados del moderador</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="font-semibold">{titulo || "No hay votación activa"}</p>
            <p>Tipo: {tipoVotacion}</p>
            <p>Votos emitidos: {votosEmitidos}</p>

            {tipoVotacion === "resolucion" && (
              <>
                <p>
                  A favor: {votosAFavor} — En contra: {votosEnContra}
                </p>
                <p>Porcentaje a favor: {porcentajeAprobacion}%</p>
              </>
            )}

            <div className="flex gap-2">
              <Button onClick={cerrarVotacion}>Cerrar votación</Button>
              <Button onClick={publicarResultados}>Publicar resultados</Button>
            </div>

            {tipoVotacion === "eleccion_lideres" &&
              conteoCandidatos
                .slice()
                .sort((a, b) => b.votos - a.votos)
                .map((c, index) => (
                  <div key={c.id} className="border rounded p-3">
                    <p className="font-semibold">
                      #{index + 1} {c.nombre}
                    </p>
                    <p>Votos: {c.votos}</p>
                    <p>Porciento: {c.porcentaje}%</p>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}