export function getDeviceId() {
  if (typeof window === "undefined") return "server"

  const key = "voto_device_id"
  let deviceId = localStorage.getItem(key)

  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(key, deviceId)
  }

  return deviceId
}