import { NextRequest, NextResponse } from "next/server";

import { runComparativeSynthesis } from "@/lib/synthesis/comparative";
import {
  getSynthesis,
  upsertSynthesis,
  type SynthesisKind,
} from "@/lib/synthesis/dao";

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
      return NextResponse.json(
        { error: "Invalid kind" },
        { status: 400 }
      );
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

  // Memo and risk_register arrive in PR 9. Gate BEFORE the "running" upsert
  // so we never leave a stuck running row for an unimplemented kind.
  if (kind !== "comparative") {
    return NextResponse.json(
      { error: `${kind} synthesis arrives in PR 9.` },
      { status: 501 }
    );
  }

  await upsertSynthesis({ kind, status: "running" });

  try {
    const run = await runComparativeSynthesis();
    const record = await upsertSynthesis({
      kind,
      status: "complete",
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      latencyMs: run.latencyMs,
      result: run.result,
    });
    return NextResponse.json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Comparative synthesis failed:`, err);
    const record = await upsertSynthesis({
      kind,
      status: "error",
      error: message,
    });
    return NextResponse.json(record, { status: 500 });
  }
}
