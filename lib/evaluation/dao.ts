import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";

import type { CategoryEvaluationResult } from "./types";

export type EvaluationCategory = "technical" | "commercial" | "compliance";
export type EvaluationStatus =
  | "pending"
  | "running"
  | "complete"
  | "error";

export interface EvaluationRecord {
  id: string;
  vendorId: string;
  category: EvaluationCategory;
  status: EvaluationStatus;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  result: CategoryEvaluationResult | null;
  error: string | null;
  updatedAt: string;
}

function rowToRecord(
  row: typeof schema.evaluations.$inferSelect
): EvaluationRecord {
  return {
    id: row.id,
    vendorId: row.vendorId,
    category: row.category as EvaluationCategory,
    status: row.status as EvaluationStatus,
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    latencyMs: row.latencyMs,
    result: (row.result as CategoryEvaluationResult) ?? null,
    error: row.error,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getEvaluation(
  vendorId: string,
  category: EvaluationCategory
): Promise<EvaluationRecord | null> {
  const rows = await db
    .select()
    .from(schema.evaluations)
    .where(
      and(
        eq(schema.evaluations.vendorId, vendorId),
        eq(schema.evaluations.category, category)
      )
    )
    .limit(1);
  return rows.length > 0 ? rowToRecord(rows[0]) : null;
}

export async function listEvaluations(): Promise<EvaluationRecord[]> {
  const rows = await db.select().from(schema.evaluations);
  return rows.map(rowToRecord);
}

export async function upsertEvaluation(input: {
  vendorId: string;
  category: EvaluationCategory;
  status: EvaluationStatus;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  result?: CategoryEvaluationResult;
  error?: string;
}): Promise<EvaluationRecord> {
  const existing = await getEvaluation(input.vendorId, input.category);
  const now = new Date();

  if (existing) {
    const [updated] = await db
      .update(schema.evaluations)
      .set({
        status: input.status,
        model: input.model ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        latencyMs: input.latencyMs ?? null,
        result: input.result ?? null,
        error: input.error ?? null,
        updatedAt: now,
      })
      .where(eq(schema.evaluations.id, existing.id))
      .returning();
    return rowToRecord(updated);
  }

  const id = `eval_${input.vendorId}_${input.category}_${Date.now()}`;
  const [inserted] = await db
    .insert(schema.evaluations)
    .values({
      id,
      vendorId: input.vendorId,
      category: input.category,
      status: input.status,
      model: input.model ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      latencyMs: input.latencyMs ?? null,
      result: input.result ?? null,
      error: input.error ?? null,
    })
    .returning();
  return rowToRecord(inserted);
}
