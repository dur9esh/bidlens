import { NextRequest, NextResponse } from "next/server";

import { logAuditEvent } from "@/lib/audit/log";
import { runComparativeSynthesis } from "@/lib/synthesis/comparative";
import {
  getSynthesis,
  upsertSynthesis,
  type SynthesisKind,
} from "@/lib/synthesis/dao";
import { generateEvaluationMemo } from "@/lib/synthesis/memo";
import { generateRiskRegister } from "@/lib/synthesis/risk-register";

export const runtime = "nodejs";
export const maxDuration = 180;

const VALID_KINDS: SynthesisKind[] = [
  "comparative",
  "memo",
  "risk_register",
];

function isValidKind(k: string): k is SynthesisKind {
  return (VALID_KINDS as string[]).includes(k);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  try {
    const { kind } = await params;
    if (!isValidKind(kind)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    const record = await getSynthesis(kind);
    return NextResponse.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params;
  if (!isValidKind(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  await upsertSynthesis({ kind, status: "running" });

  try {
    let run;
    if (kind === "comparative") {
      run = await runComparativeSynthesis();
    } else if (kind === "memo") {
      run = await generateEvaluationMemo();
    } else {
      // kind === "risk_register" — guarded by isValidKind above.
      run = await generateRiskRegister();
    }

    const record = await upsertSynthesis({
      kind,
      status: "complete",
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      latencyMs: run.latencyMs,
      result: run.result,
    });
    await logAuditEvent({
      eventType: "synthesis.run",
      resourceKind: "synthesis",
      resourceId: kind,
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      latencyMs: run.latencyMs,
      status: "complete",
      metadata: { kind },
    });
    return NextResponse.json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`${kind} synthesis failed:`, err);
    const record = await upsertSynthesis({
      kind,
      status: "error",
      error: message,
    });
    await logAuditEvent({
      eventType: "synthesis.run",
      resourceKind: "synthesis",
      resourceId: kind,
      status: "error",
      metadata: { kind, error_message: message },
    });
    return NextResponse.json(record, { status: 500 });
  }
}
