import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { asambleaPerteneceAlTenant, obtenerTenantSesion } from "@/lib/tenant"
import { calcularNecesarios, calcularVotosValidosCandidatos } from "@/lib/votacionHelpers"

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesionValida =
    req.cookies.get("auth_session")?.value === "true" ||
    req.cookies.get("moderador_session")?.value === "true"

  if (!sesionValida) {
    return NextResponse.json({ ok: false, error: "NO_AUTORIZADO" }, { status: 401 })
  }

  const { id } = await params
  const supabaseAdmin = crearSupabaseAdmin()
  const { data: asamblea, error: errorAsamblea } = await supabaseAdmin
    .from("asambleas")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (errorAsamblea || !asamblea) {
    return NextResponse.json(
      { ok: false, error: errorAsamblea?.message || "ASAMBLEA_NO_ENCONTRADA" },
      { status: 404 }
    )
  }

  if (!asambleaPerteneceAlTenant(obtenerTenantSesion(req), asamblea)) {
    return NextResponse.json({ ok: false, error: "ASAMBLEA_NO_AUTORIZADA" }, { status: 403 })
  }

  const { data: votacionesData, error: errorVotaciones } = await supabaseAdmin
    .from("votaciones")
    .select("*")
    .eq("asamblea_id", id)
    .order("creada_en", { ascending: true })

  if (errorVotaciones) {
    return NextResponse.json({ ok: false, error: errorVotaciones.message }, { status: 500 })
  }

  const votacionIds = (votacionesData || []).map((votacion) => votacion.id)
  const vacio = Promise.resolve({ data: [], error: null })
  const [respuestaVotos, respuestaManuales, respuestaCandidatos, respuestaEventos] =
    await Promise.all([
      votacionIds.length
        ? supabaseAdmin
            .from("votos")
            .select("votacion_id, opcion, candidato_id")
            .in("votacion_id", votacionIds)
        : vacio,
      votacionIds.length
        ? supabaseAdmin
            .from("votos_manuales")
            .select("votacion_id, opcion, candidato_id, cantidad")
            .in("votacion_id", votacionIds)
        : vacio,
      votacionIds.length
        ? supabaseAdmin
            .from("candidatos")
            .select("id, votacion_id, nombre")
            .in("votacion_id", votacionIds)
            .order("nombre", { ascending: true })
        : vacio,
      supabaseAdmin
        .from("asamblea_eventos")
        .select("id, tipo, descripcion, creado_en")
        .eq("asamblea_id", id)
        .in("tipo", ["receso_iniciado", "trabajos_reanudados"])
        .order("creado_en", { ascending: true }),
    ])

  const errorDatos =
    respuestaVotos.error ||
    respuestaManuales.error ||
    respuestaCandidatos.error ||
    respuestaEventos.error

  if (errorDatos) {
    return NextResponse.json({ ok: false, error: errorDatos.message }, { status: 500 })
  }

  const votos = respuestaVotos.data || []
  const votosManuales = respuestaManuales.data || []
  const candidatos = respuestaCandidatos.data || []
  const votaciones = (votacionesData || []).map((votacion) => {
    const votosVotacion = votos.filter((voto) => voto.votacion_id === votacion.id)
    const manualesVotacion = votosManuales.filter(
      (voto) => voto.votacion_id === votacion.id
    )
    const candidatosVotacion = candidatos.filter(
      (candidato) => candidato.votacion_id === votacion.id
    )
    const manuales = manualesVotacion.reduce(
      (total, voto) => total + Number(voto.cantidad || 0),
      0
    )
    const favor =
      votosVotacion.filter((voto) => voto.opcion === "favor").length +
      manualesVotacion
        .filter((voto) => voto.opcion === "favor")
        .reduce((total, voto) => total + Number(voto.cantidad || 0), 0)
    const contra =
      votosVotacion.filter((voto) => voto.opcion === "contra").length +
      manualesVotacion
        .filter((voto) => voto.opcion === "contra")
        .reduce((total, voto) => total + Number(voto.cantidad || 0), 0)
    const abstencion =
      votosVotacion.filter((voto) => voto.opcion === "abstencion").length +
      manualesVotacion
        .filter((voto) => voto.opcion === "abstencion")
        .reduce((total, voto) => total + Number(voto.cantidad || 0), 0)
    const candidatosConteo = candidatosVotacion.map((candidato) => ({
      nombre: candidato.nombre,
      votos:
        votosVotacion.filter((voto) => voto.candidato_id === candidato.id).length +
        manualesVotacion
          .filter((voto) => voto.candidato_id === candidato.id)
          .reduce((total, voto) => total + Number(voto.cantidad || 0), 0),
    }))
    const necesarios = calcularNecesarios(
      votacion.tipo_votacion === "eleccion_lideres"
        ? calcularVotosValidosCandidatos(candidatosConteo)
        : favor + contra,
      votacion.tipo_mayoria
    )

    return {
      ...votacion,
      tipo_votacion: votacion.tipo_votacion || "resolucion",
      tipo_mocion: votacion.tipo_mocion || "resolucion_principal",
      ganadorNombre:
        candidatosVotacion.find((candidato) => candidato.id === votacion.ganador_id)?.nombre ||
        "",
      emitidos: votosVotacion.length + manuales,
      manuales,
      favor,
      contra,
      abstencion,
      necesarios,
      aprobado: favor >= necesarios && favor + contra > 0,
      candidatos: candidatosConteo,
    }
  })

  return NextResponse.json(
    {
      ok: true,
      asamblea,
      votaciones,
      eventos: respuestaEventos.data || [],
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
