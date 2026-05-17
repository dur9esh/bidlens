import { db, schema } from "@/db";

export type AuditEventType =
  | "ingestion.run"
  | "evaluation.run"
  | "synthesis.run"
  | "qa.run"
  | "rubric.update"
  | "rubric.reset";

export interface LogAuditEventInput {
  eventType: AuditEventType;
  resourceKind?: string;
  resourceId?: string;
  actor?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  status?: "complete" | "error";
  metadata?: Record<string, unknown>;
}

/**
 * Record one audit event. Fire-and-forget — failures here must NOT break the
 * primary workflow (the agent ran, the user got their result). Errors are
 * logged to console only.
 */
export async function logAuditEvent(
  input: LogAuditEventInput
): Promise<void> {
  try {
    await db.insert(schema.auditEvents).values({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      eventType: input.eventType,
      resourceKind: input.resourceKind ?? null,
      resourceId: input.resourceId ?? null,
      actor: input.actor ?? "demo_user",
      model: input.model ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      latencyMs: input.latencyMs ?? null,
      status: input.status ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    console.error("[audit] Failed to log event:", err);
  }
}
