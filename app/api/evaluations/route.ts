import { NextResponse } from "next/server";

import { listEvaluations } from "@/lib/evaluation/dao";

export const runtime = "nodejs";

export async function GET() {
  try {
    const records = await listEvaluations();
    return NextResponse.json(records);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
