import { NextRequest, NextResponse } from "next/server";

import { logAuditEvent } from "@/lib/audit/log";
import { answerQuestion } from "@/lib/qa/agent";
import { insertTurn, listTurns } from "@/lib/qa/dao";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const turns = await listTurns(sessionId);
    return NextResponse.json(turns);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  let body: { question?: unknown };
  try {
    body = (await req.json()) as { question?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  if (!body?.question || typeof body.question !== "string") {
    return NextResponse.json(
      { error: "Question is required" },
      { status: 400 }
    );
  }
  const question = body.question;

  const recentTurns = await listTurns(sessionId);
  const recentContext = recentTurns
    .slice(-3)
    .map((t) => ({ question: t.question, answer: t.answer }));

  try {
    const run = await answerQuestion(question, recentContext);
    const turn = await insertTurn({
      sessionId,
      question,
      answer: run.result.answer,
      citations: run.result.citations,
      status: "complete",
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      latencyMs: run.latencyMs,
    });
    await logAuditEvent({
      eventType: "qa.run",
      resourceKind: "session",
      resourceId: sessionId,
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      latencyMs: run.latencyMs,
      status: "complete",
      metadata: { question_preview: question.slice(0, 120) },
    });
    return NextResponse.json(turn);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Q&A failed for session ${sessionId}:`, err);
    const turn = await insertTurn({
      sessionId,
      question,
      status: "error",
      error: message,
    });
    await logAuditEvent({
      eventType: "qa.run",
      resourceKind: "session",
      resourceId: sessionId,
      status: "error",
      metadata: { question_preview: question.slice(0, 120), error: message },
    });
    return NextResponse.json(turn, { status: 500 });
  }
}
