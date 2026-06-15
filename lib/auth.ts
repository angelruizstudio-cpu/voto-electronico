import { createHash, randomBytes, timingSafeEqual } from "crypto"

export type RolSistema = "owner" | "admin" | "moderador" | "escrutinio" | "oficina" | "puerta"

export const ROLES_SISTEMA: RolSistema[] = [
  "owner",
  "admin",
  "moderador",
  "escrutinio",
  "oficina",
  "puerta",
]

export const etiquetaRol = (rol: string) => {
  if (rol === "owner") return "Dueño del sistema"
  if (rol === "admin") return "Administrador"
  if (rol === "moderador") return "Moderador"
  if (rol === "escrutinio") return "Comité de Escrutinio"
  if (rol === "oficina") return "Registro"
  if (rol === "puerta") return "Puerta"
  return rol
}

const hashPassword = (password: string, salt: string) =>
  createHash("sha256").update(`${salt}:${password}`).digest("hex")

export const crearPasswordSeguro = (password: string) => {
  const salt = randomBytes(16).toString("hex")
  return {
    salt,
    hash: hashPassword(password, salt),
  }
}

export const verificarPassword = (
  password: string,
  salt: string,
  hashGuardado: string
) => {
  const hashIngresado = hashPassword(password, salt)
  const a = Buffer.from(hashIngresado, "hex")
  const b = Buffer.from(hashGuardado, "hex")

  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}
