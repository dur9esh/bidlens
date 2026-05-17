import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";

import type { QaAnswerCitation } from "./types";

export interface QaTurnRecord {
  id: string;
  sessionId: string;
  question: string;
  answer: string | null;
  citations: QaAnswerCitation[] | null;
  status: "pending" | "running" | "complete" | "error";
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  error: string | null;
  createdAt: string;
}

function rowToRecord(row: typeof schema.qaTurns.$inferSelect): QaTurnRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    question: row.question,
    answer: row.answer,
    citations: (row.citations as QaAnswerCitation[]) ?? null,
    status: row.status as QaTurnRecord["status"],
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    latencyMs: row.latencyMs,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTurns(sessionId: string): Promise<QaTurnRecord[]> {
  const rows = await db
    .select()
    .from(schema.qaTurns)
    .where(eq(schema.qaTurns.sessionId, sessionId))
    .orderBy(asc(schema.qaTurns.createdAt));
  return rows.map(rowToRecord);
}

export async function insertTurn(input: {
  sessionId: string;
  question: string;
  answer?: string;
  citations?: QaAnswerCitation[];
  status: QaTurnRecord["status"];
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  error?: string;
}): Promise<QaTurnRecord> {
  const id = `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const [inserted] = await db
    .insert(schema.qaTurns)
    .values({
      id,
      sessionId: input.sessionId,
      question: input.question,
      answer: input.answer ?? null,
      citations: input.citations ?? null,
      status: input.status,
      model: input.model ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      latencyMs: input.latencyMs ?? null,
      error: input.error ?? null,
    })
    .returning();
  return rowToRecord(inserted);
}
