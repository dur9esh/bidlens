import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import type { DocumentKind } from "@/lib/documents";

export interface IngestionRecord {
  id: string;
  documentId: string;
  documentKind: DocumentKind;
  status: "pending" | "running" | "complete" | "error";
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  result: unknown | null;
  error: string | null;
  updatedAt: string;
}

function rowToRecord(
  row: typeof schema.ingestions.$inferSelect
): IngestionRecord {
  return {
    id: row.id,
    documentId: row.documentId,
    documentKind: row.documentKind as DocumentKind,
    status: row.status as IngestionRecord["status"],
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    latencyMs: row.latencyMs,
    result: row.result,
    error: row.error,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getIngestion(
  documentId: string
): Promise<IngestionRecord | null> {
  const rows = await db
    .select()
    .from(schema.ingestions)
    .where(eq(schema.ingestions.documentId, documentId))
    .limit(1);
  return rows.length > 0 ? rowToRecord(rows[0]) : null;
}

export async function listIngestions(): Promise<IngestionRecord[]> {
  const rows = await db.select().from(schema.ingestions);
  return rows.map(rowToRecord);
}

export async function upsertIngestion(input: {
  documentId: string;
  documentKind: DocumentKind;
  status: IngestionRecord["status"];
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  result?: unknown;
  error?: string;
}): Promise<IngestionRecord> {
  const existing = await getIngestion(input.documentId);
  const now = new Date();

  if (existing) {
    const [updated] = await db
      .update(schema.ingestions)
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
      .where(eq(schema.ingestions.id, existing.id))
      .returning();
    return rowToRecord(updated);
  }

  const id = `ing_${input.documentId}_${Date.now()}`;
  const [inserted] = await db
    .insert(schema.ingestions)
    .values({
      id,
      documentId: input.documentId,
      documentKind: input.documentKind,
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
