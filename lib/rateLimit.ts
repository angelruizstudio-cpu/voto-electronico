// Rate-limit best-effort en memoria. En entornos serverless cada instancia
// tiene su propio mapa, así que no es una defensa perfecta, pero frena la
// enumeración de credenciales (A001, A002, …) desde un mismo dispositivo, que
// era una vía trivial para molestar a los votantes.
type Registro = { conteo: number; reinicioEn: number }

const registros = new Map<string, Registro>()

export function rateLimit(clave: string, limite = 30, ventanaMs = 60000): boolean {
  const ahora = Date.now()
  const registro = registros.get(clave)

  if (!registro || ahora > registro.reinicioEn) {
    registros.set(clave, { conteo: 1, reinicioEn: ahora + ventanaMs })
    return true
  }

  if (registro.conteo >= limite) {
    return false
  }

  registro.conteo += 1
  return true
}

// Limpieza perezosa para que el mapa no crezca sin límite.
export function limpiarRateLimit() {
  const ahora = Date.now()
  for (const [clave, registro] of registros) {
    if (ahora > registro.reinicioEn) registros.delete(clave)
  }
}
