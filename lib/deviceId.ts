import { generarUUID } from "@/lib/uuid"

export function getDeviceId() {
  if (typeof window === "undefined") return "server"

  const key = "voto_device_id"

  let deviceId: string | null = null

  try {
    deviceId = localStorage.getItem(key)
  } catch {
    deviceId = null
  }

  if (!deviceId) {
    deviceId = generarUUID()

    try {
      localStorage.setItem(key, deviceId)
    } catch {
      // Modo privado o almacenamiento bloqueado: seguimos con un id efímero
      // para no romper el flujo de votación.
    }
  }

  return deviceId
}
