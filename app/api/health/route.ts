import { NextResponse } from "next/server";

import { getAI, MODELS } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const startedAt = Date.now();

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODELS.FLASH,
      contents:
        'Respond with exactly this text and nothing else: "BidLens health check OK"',
    });

    const text = (response.text ?? "").trim();
    const latencyMs = Date.now() - startedAt;

    return NextResponse.json({
      status: "ok",
      model: MODELS.FLASH,
      modelResponse: text,
      latencyMs,
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
