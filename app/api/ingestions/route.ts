import { NextResponse } from "next/server";

import { listIngestions } from "@/lib/ingestion/dao";

export const runtime = "nodejs";

export async function GET() {
  try {
    const records = await listIngestions();
    return NextResponse.json(records);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
