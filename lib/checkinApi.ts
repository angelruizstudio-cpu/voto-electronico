import { fetchConTimeout } from "@/lib/fetchConTimeout"

async function enviarCheckin(cuerpo: Record<string, unknown>) {
  const resultado = await fetchConTimeout("/api/checkin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cuerpo),
  })

  if (!resultado.ok) {
    return {
      ok: false as const,
      error: resultado.motivo === "timeout" ? "TIEMPO_AGOTADO" : "SIN_CONEXION",
    }
  }

  const data = await resultado.res.json().catch(() => null)

  if (!resultado.res.ok || !data?.ok) {
    return {
      ok: false as const,
      error: data?.error || "ERROR_CHECKIN",
    }
  }

  return {
    ok: true as const,
    token: data.token,
    asamblea: data.asamblea,
    asambleista: data.asambleista,
  }
}

export async function hacerCheckin(credencial: string, deviceId: string, orgSlug?: string) {
  return enviarCheckin({ credencial, deviceId, orgSlug })
}

export async function hacerCheckinAutomatico(accessToken: string, deviceId: string, orgSlug?: string) {
  return enviarCheckin({ accessToken, deviceId, orgSlug })
}
