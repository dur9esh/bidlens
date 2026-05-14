import { NextRequest, NextResponse } from "next/server";

import { getDocument } from "@/lib/documents";
import {
  getEvaluation,
  upsertEvaluation,
  type EvaluationCategory,
} from "@/lib/evaluation/dao";
import { evaluateTechnical } from "@/lib/evaluation/technical";

export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_CATEGORIES: EvaluationCategory[] = [
  "technical",
  "commercial",
  "compliance",
];

function isValidCategory(c: string): c is EvaluationCategory {
  return (VALID_CATEGORIES as string[]).includes(c);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ vendorId: string; category: string }> }
) {
  try {
    const { vendorId, category } = await params;
    if (!isValidCategory(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    const record = await getEvaluation(vendorId, category);
    return NextResponse.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ vendorId: string; category: string }> }
) {
  const { vendorId, category } = await params;

  if (!isValidCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const doc = getDocument(vendorId);
  if (!doc || doc.kind !== "bid") {
    return NextResponse.json(
      { error: "Vendor bid not found" },
      { status: 404 }
    );
  }

  // PR 5 only implements the technical evaluator. Commercial + compliance
  // arrive in PRs 6-7.
  if (category !== "technical") {
    return NextResponse.json(
      {
        error: `The ${category} evaluator is not implemented yet (arrives in a later PR).`,
      },
      { status: 501 }
    );
  }

  await upsertEvaluation({ vendorId, category, status: "running" });

  try {
    const run = await evaluateTechnical(vendorId);
    const record = await upsertEvaluation({
      vendorId,
      category,
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
    console.error(
      `Technical evaluation failed for ${vendorId}:`,
      err
    );
    const record = await upsertEvaluation({
      vendorId,
      category,
      status: "error",
      error: message,
    });
    return NextResponse.json(record, { status: 500 });
  }
}
