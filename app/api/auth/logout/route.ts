import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ ok: true })

  for (const cookie of [
    "auth_session",
    "auth_role",
    "auth_name",
    "auth_user_id",
    "moderador_session",
  ]) {
    response.cookies.set(cookie, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "strict",
    })
  }

  return response
}
