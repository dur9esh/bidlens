import { desc } from "drizzle-orm";

import { db, schema } from "@/db";

import type { AuditEventType } from "./log";

export interface AuditEventRecord {
  id: string;
  eventType: AuditEventType;
  resourceKind: string | null;
  resourceId: string | null;
  actor: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function rowToRecord(
  row: typeof schema.auditEvents.$inferSelect
): AuditEventRecord {
  return {
    id: row.id,
    eventType: row.eventType as AuditEventType,
    resourceKind: row.resourceKind,
    resourceId: row.resourceId,
    actor: row.actor,
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    latencyMs: row.latencyMs,
    status: row.status,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAuditEvents(
  limit = 200
): Promise<AuditEventRecord[]> {
  const rows = await db
    .select()
    .from(schema.auditEvents)
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(limit);
  return rows.map(rowToRecord);
}
