// fetch con timeout y detección de red caída. En un salón con cientos de
// teléfonos compitiendo por el WiFi, las peticiones se cuelgan; sin timeout el
// spinner del votante quedaba activo para siempre y bloqueaba todos los botones.
export type ResultadoFetch =
  | { ok: true; res: Response }
  | { ok: false; motivo: "timeout" | "red" }

export async function fetchConTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 12000
): Promise<ResultadoFetch> {
  const controlador = new AbortController()
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs)

  try {
    const res = await fetch(input, { ...init, signal: controlador.signal })
    return { ok: true, res }
  } catch (error) {
    const abortado =
      error instanceof DOMException && error.name === "AbortError"
    return { ok: false, motivo: abortado ? "timeout" : "red" }
  } finally {
    clearTimeout(temporizador)
  }
}
