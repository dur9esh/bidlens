import { NextRequest, NextResponse } from "next/server";

import { getDocument } from "@/lib/documents";
import {
  getEvaluation,
  upsertEvaluation,
  type EvaluationCategory,
} from "@/lib/evaluation/dao";
import { evaluateCommercial } from "@/lib/evaluation/commercial";
import { evaluateCompliance } from "@/lib/evaluation/compliance";
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

  await upsertEvaluation({ vendorId, category, status: "running" });

  try {
    let run;
    if (category === "technical") {
      run = await evaluateTechnical(vendorId);
    } else if (category === "commercial") {
      run = await evaluateCommercial(vendorId);
    } else {
      // category === "compliance" — guarded by isValidCategory above.
      run = await evaluateCompliance(vendorId);
    }

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
      `${category} evaluation failed for ${vendorId}:`,
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
