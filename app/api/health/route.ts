import { NextResponse } from "next/server";
import { getClaude, MODELS, extractText } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const startedAt = Date.now();

  try {
    const claude = getClaude();

    const response = await claude.messages.create({
      model: MODELS.SONNET,
      max_tokens: 64,
      messages: [
        {
          role: "user",
          content:
            'Respond with exactly this text and nothing else: "BidLens health check OK"',
        },
      ],
    });

    const text = extractText(response.content).trim();
    const latencyMs = Date.now() - startedAt;

    return NextResponse.json({
      status: "ok",
      model: MODELS.SONNET,
      claudeResponse: text,
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown error";
    return NextResponse.json(
      {
        status: "error",
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
