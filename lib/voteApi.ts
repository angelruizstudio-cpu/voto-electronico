import { fetchConTimeout } from "@/lib/fetchConTimeout"

export async function enviarVoto({
  token,
  votacionId,
  opcion,
  candidatoId = null,
  deviceId,
}: {
  token: string
  votacionId: string
  opcion?: string | null
  candidatoId?: string | null
  deviceId: string
}) {
  const resultado = await fetchConTimeout("/api/vote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
      votacionId,
      opcion,
      candidatoId,
      deviceId,
    }),
  })

  if (!resultado.ok) {
    return {
      ok: false,
      code: resultado.motivo === "timeout" ? "TIEMPO_AGOTADO" : "SIN_CONEXION",
    }
  }

  const data = await resultado.res.json().catch(() => null)

  if (!resultado.res.ok || !data) {
    return {
      ok: false,
      code: data?.code || data?.error || "ERROR_DESCONOCIDO",
    }
  }

  return {
    ok: true,
    code: "OK",
  }
}
