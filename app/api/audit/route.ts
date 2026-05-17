import { NextResponse } from "next/server";

import { listAuditEvents } from "@/lib/audit/dao";

export const runtime = "nodejs";

export async function GET() {
  try {
    const events = await listAuditEvents(200);
    return NextResponse.json(events);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
