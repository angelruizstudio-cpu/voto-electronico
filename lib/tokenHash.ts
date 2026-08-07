import { createHash } from "crypto"

// Hashea el token de votación antes de guardarlo. La columna se llama
// `token_hash` pero antes guardaba el token en claro, de modo que cualquier
// lectura de la tabla permitía votar suplantando a otros. Ahora se guarda el
// SHA-256 y el token en claro solo vive en el dispositivo del votante.
export function hashTokenVotacion(tokenPlano: string): string {
  return createHash("sha256").update(String(tokenPlano)).digest("hex")
}
