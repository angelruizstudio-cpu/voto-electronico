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
  const res = await fetch("/api/vote", {
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

  const data = await res.json()

  if (!res.ok) {
    return {
      ok: false,
      code: data.code || data.error || "ERROR_DESCONOCIDO",
    }
  }

  return {
    ok: true,
    code: "OK",
  }
}