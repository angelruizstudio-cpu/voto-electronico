import { randomInt } from "crypto"

const CARACTERES_CREDENCIAL = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

export type FilaPreRegistro = {
  fila?: unknown
  nombre?: unknown
  email?: unknown
  telefono?: unknown
  iglesia?: unknown
  distrito?: unknown
  metodoVoto?: unknown
}

export type PreRegistroValidado = {
  fila: number
  nombre: string
  email: string | null
  telefono: string | null
  iglesia: string
  distrito: string
  metodo_voto: "electronico" | "manual"
  credencial: string
}

export function limpiarEmail(email: unknown) {
  const emailLimpio = String(email || "").trim().toLowerCase()

  if (!emailLimpio) return ""

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio) ? emailLimpio : ""
}

export function limpiarTelefono(telefono: unknown) {
  const telefonoLimpio = String(telefono || "").trim()

  if (!telefonoLimpio) return ""
  if (/^\+[1-9]\d{7,14}$/.test(telefonoLimpio)) return telefonoLimpio

  const digitos = telefonoLimpio.replace(/\D/g, "")

  if (digitos.length === 10) return `+1${digitos}`
  if (digitos.length === 11 && digitos.startsWith("1")) return `+${digitos}`

  return ""
}

export function generarCredencialCandidata(codigoTenant: string) {
  const prefijo = String(codigoTenant || "KTG")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5) || "KTG"
  const segmento = () => Array.from({ length: 3 })
    .map(() => CARACTERES_CREDENCIAL[randomInt(0, CARACTERES_CREDENCIAL.length)])
    .join("")

  return `${prefijo}-${segmento()}-${segmento()}`
}

export function prepararPreRegistroMasivo({
  filas,
  codigoTenant,
  credencialesOcupadas,
}: {
  filas: unknown[]
  codigoTenant: string
  credencialesOcupadas: Set<string>
}) {
  const registros: PreRegistroValidado[] = []
  const errores: string[] = []

  filas.forEach((valor, indice) => {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
      errores.push(`Fila ${indice + 2}: formato inválido`)
      return
    }

    const fila = valor as FilaPreRegistro
    const numeroFila = Number.isInteger(fila.fila) ? Number(fila.fila) : indice + 2
    const nombre = String(fila.nombre || "").trim()
    const emailOriginal = String(fila.email || "").trim()
    const telefonoOriginal = String(fila.telefono || "").trim()
    const email = limpiarEmail(emailOriginal)
    const telefono = limpiarTelefono(telefonoOriginal)

    if (!nombre) {
      errores.push(`Fila ${numeroFila}: falta nombre`)
      return
    }

    if (emailOriginal && !email) {
      errores.push(`Fila ${numeroFila}: email inválido`)
      return
    }

    if (telefonoOriginal && !telefono) {
      errores.push(`Fila ${numeroFila}: teléfono inválido`)
      return
    }

    let credencial = ""

    for (let intento = 0; intento < 12 && !credencial; intento += 1) {
      const candidata = generarCredencialCandidata(codigoTenant)

      if (!credencialesOcupadas.has(candidata)) {
        credencial = candidata
        credencialesOcupadas.add(candidata)
      }
    }

    if (!credencial) {
      errores.push(`Fila ${numeroFila}: no se pudo generar una credencial única`)
      return
    }

    registros.push({
      fila: numeroFila,
      nombre,
      email: email || null,
      telefono: telefono || null,
      iglesia: String(fila.iglesia || "").trim(),
      distrito: String(fila.distrito || "").trim(),
      metodo_voto: fila.metodoVoto === "manual" ? "manual" : "electronico",
      credencial,
    })
  })

  return { registros, errores }
}
