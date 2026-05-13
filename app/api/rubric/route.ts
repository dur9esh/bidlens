import { NextRequest, NextResponse } from "next/server";
import { getDefaultRubric, updateRubricContent } from "@/lib/rubric/dao";
import type { RubricContent } from "@/lib/rubric/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rubric = await getDefaultRubric();
    return NextResponse.json(rubric);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { id: string; content: RubricContent };
    if (!body?.id || !body?.content) {
      return NextResponse.json(
        { error: "Request body requires id and content" },
        { status: 400 }
      );
    }
    const updated = await updateRubricContent(body.id, body.content);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
