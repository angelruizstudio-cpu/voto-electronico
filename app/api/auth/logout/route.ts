import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ ok: true })

  for (const cookie of [
    "auth_session",
    "auth_role",
    "auth_roles",
    "auth_name",
    "auth_user_id",
    "auth_org_id",
    "auth_org_name",
    "auth_org_slug",
    "auth_org_code",
    "auth_owner_session",
    "moderador_session",
    "auth_sig",
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
