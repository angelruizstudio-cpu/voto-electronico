import { NextRequest, NextResponse } from "next/server"
import { getSentMessageStatus } from "@/lib/sent"

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  const messageId = req.nextUrl.searchParams.get("messageId")

  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 })
  }

  try {
    const data = await getSentMessageStatus(messageId)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error checking Sent.dm status" },
      { status: 500 }
    )
  }
}
