import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const session = req.cookies.get("moderador_session")

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

// Bug #9 corregido: protege / y todas las subrutas del moderador
export const config = {
  matcher: ["/", "/moderador", "/moderador/:path*"],
}