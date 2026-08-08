import type { NextRequest, NextResponse } from "next/server"

// Firma la sesión administrativa para que las cookies no puedan falsificarse.
// Antes, cualquiera podía fabricar `auth_session=true` + `auth_roles` con curl y
// obtener acceso completo. Ahora se escribe una cookie `auth_sig` con un HMAC
// sobre los valores sensibles; el middleware la verifica en cada petición.
//
// Funciona en el runtime Edge (middleware) y en Node (route handlers) porque solo
// usa Web Crypto (crypto.subtle), disponible en ambos.
//
// Compatibilidad: si SESSION_SECRET no está configurado, la verificación se
// omite y el sistema se comporta como antes (no se bloquea a nadie). Al definir
// SESSION_SECRET la protección se activa; las sesiones previas sin firma tendrán
// que volver a iniciar sesión.

const NOMBRES_FIRMABLES = [
  "auth_session",
  "moderador_session",
  "auth_owner_session",
  "auth_role",
  "auth_roles",
  "auth_name",
  "auth_user_id",
  "auth_org_id",
  "auth_org_name",
  "auth_org_slug",
  "auth_org_code",
] as const

export function obtenerSecretoSesion(): string {
  return process.env.SESSION_SECRET || ""
}

function cadenaCanonica(leer: (nombre: string) => string): string {
  return NOMBRES_FIRMABLES.map((nombre) => `${nombre}=${leer(nombre)}`).join("&")
}

async function firmarCadena(secret: string, mensaje: string): Promise<string> {
  const codificador = new TextEncoder()
  const clave = await crypto.subtle.importKey(
    "raw",
    codificador.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const firma = await crypto.subtle.sign("HMAC", clave, codificador.encode(mensaje))
  return Array.from(new Uint8Array(firma), (b) => b.toString(16).padStart(2, "0")).join("")
}

function igualesTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let resultado = 0
  for (let i = 0; i < a.length; i++) {
    resultado |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return resultado === 0
}

// Escribe auth_sig sobre el estado efectivo de las cookies: el valor que quedó en
// la respuesta si se cambió, o el que traía la petición si no. Debe llamarse en
// cualquier ruta que modifique las cookies de sesión (login, acceso-admin).
export async function firmarRespuestaSesion(
  response: NextResponse,
  req: NextRequest,
  secret: string
): Promise<void> {
  if (!secret) return

  const leer = (nombre: string) =>
    response.cookies.get(nombre)?.value ?? req.cookies.get(nombre)?.value ?? ""

  const firma = await firmarCadena(secret, cadenaCanonica(leer))

  response.cookies.set("auth_sig", firma, {
    path: "/",
    maxAge: 43200,
    httpOnly: true,
    sameSite: "strict",
  })
}

export async function sesionFirmadaValida(req: NextRequest, secret: string): Promise<boolean> {
  const firma = req.cookies.get("auth_sig")?.value

  if (!firma) return false

  const esperado = await firmarCadena(
    secret,
    cadenaCanonica((nombre) => req.cookies.get(nombre)?.value ?? "")
  )

  return igualesTiempoConstante(firma, esperado)
}
