// Genera un UUID v4 con respaldo para navegadores viejos o contextos no seguros.
// crypto.randomUUID no existe en Safari/iOS < 15.4, Chrome < 92 ni cuando la
// página se sirve sin HTTPS, lo que en esos dispositivos rompía el check-in y
// las suscripciones realtime del votante.
export function generarUUID(): string {
  const cripto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined

  if (cripto && typeof cripto.randomUUID === "function") {
    return cripto.randomUUID()
  }

  const bytes = new Uint8Array(16)

  if (cripto && typeof cripto.getRandomValues === "function") {
    cripto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }

  // Ajusta version (4) y variant (RFC 4122).
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))

  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`
}
