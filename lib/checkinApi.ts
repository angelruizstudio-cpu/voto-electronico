export async function hacerCheckin(credencial: string) {
  const res = await fetch("/api/checkin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credencial }),
  })

  const data = await res.json()

  if (!res.ok) {
    return {
      ok: false,
      error: data.error || "ERROR_CHECKIN",
    }
  }

  return {
    ok: true,
    token: data.token,
    asambleista: data.asambleista,
  }
}
