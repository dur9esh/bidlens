import { eq } from "drizzle-orm";

import { db, schema } from "@/db";

import type { ComparativeSynthesisResult } from "./types";

export type SynthesisKind = "comparative" | "memo" | "risk_register";
export type SynthesisStatus =
  | "pending"
  | "running"
  | "complete"
  | "error";

export interface SynthesisRecord {
  id: string;
  kind: SynthesisKind;
  status: SynthesisStatus;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  /** Shape depends on kind. For "comparative", a ComparativeSynthesisResult. */
  result: ComparativeSynthesisResult | unknown | null;
  error: string | null;
  updatedAt: string;
}

function rowToRecord(
  row: typeof schema.syntheses.$inferSelect
): SynthesisRecord {
  return {
    id: row.id,
    kind: row.kind as SynthesisKind,
    status: row.status as SynthesisStatus,
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    latencyMs: row.latencyMs,
    result: row.result,
    error: row.error,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getSynthesis(
  kind: SynthesisKind
): Promise<SynthesisRecord | null> {
  const rows = await db
    .select()
    .from(schema.syntheses)
    .where(eq(schema.syntheses.kind, kind))
    .limit(1);
  return rows.length > 0 ? rowToRecord(rows[0]) : null;
}

export async function upsertSynthesis(input: {
  kind: SynthesisKind;
  status: SynthesisStatus;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  result?: unknown;
  error?: string;
}): Promise<SynthesisRecord> {
  const existing = await getSynthesis(input.kind);
  const now = new Date();

  if (existing) {
    const [updated] = await db
      .update(schema.syntheses)
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
      .where(eq(schema.syntheses.id, existing.id))
      .returning();
    return rowToRecord(updated);
  }

  const id = `syn_${input.kind}_${Date.now()}`;
  const [inserted] = await db
    .insert(schema.syntheses)
    .values({
      id,
      kind: input.kind,
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
