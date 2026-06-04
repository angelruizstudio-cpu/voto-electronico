import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function crearSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabaseAdmin = crearSupabaseAdmin()

  const { data, error } = await supabaseAdmin
    .from("organizaciones")
    .select("id, nombre, slug")
    .eq("activa", true)
    .order("nombre", { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, organizaciones: data || [] })
}
