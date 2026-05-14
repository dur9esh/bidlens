import { NextResponse } from "next/server";

import { generateWithFallback } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const startedAt = Date.now();

  try {
    const fb = await generateWithFallback("ingestion", {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: 'Respond with exactly this text and nothing else: "BidLens health check OK"',
            },
          ],
        },
      ],
      config: { maxOutputTokens: 256 },
    });

    return NextResponse.json({
      status: "ok",
      model: fb.modelUsed,
      modelResponse: fb.text.trim(),
      fallbacksTriggered: fb.fallbacksTriggered,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
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
