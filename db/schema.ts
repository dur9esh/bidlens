import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Single JSONB blob keeps the rubric schema flexible during prototyping —
 * we can refine the shape in lib/rubric/types.ts without a migration.
 * Normalize per-criterion later if/when we need indexed querying.
 */
export const rubrics = pgTable("rubrics", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RubricRow = typeof rubrics.$inferSelect;
export type NewRubricRow = typeof rubrics.$inferInsert;

/**
 * One row per ingestion run. Re-ingesting the same document upserts on
 * the row identified by (document_id). Result is JSONB; shape follows
 * lib/ingestion/types.ts.
 */
export const ingestions = pgTable("ingestions", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  documentKind: text("document_kind").notNull(), // "rfp" | "bid"
  status: text("status").notNull(), // "pending" | "running" | "complete" | "error"
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms"),
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type IngestionRow = typeof ingestions.$inferSelect;
export type NewIngestionRow = typeof ingestions.$inferInsert;

/**
 * One row per (vendor, category). category is "technical" | "commercial" |
 * "compliance". Re-running an evaluation upserts on (vendor_id, category).
 * result JSONB shape follows lib/evaluation/types.ts.
 */
export const evaluations = pgTable("evaluations", {
  id: text("id").primaryKey(),
  vendorId: text("vendor_id").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull(), // "pending" | "running" | "complete" | "error"
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms"),
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type EvaluationRow = typeof evaluations.$inferSelect;
export type NewEvaluationRow = typeof evaluations.$inferInsert;

/**
 * Cross-vendor synthesis outputs. One row per kind
 * ("comparative" | "memo" | "risk_register"); re-running upserts.
 * result JSONB shape follows lib/synthesis/types.ts.
 */
export const syntheses = pgTable("syntheses", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms"),
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SynthesisRow = typeof syntheses.$inferSelect;
export type NewSynthesisRow = typeof syntheses.$inferInsert;

/**
 * One row per Q&A turn. Grouped by sessionId (per-visit conversation).
 * citations is JSONB matching lib/qa/types.ts QaAnswerCitation[].
 */
export const qaTurns = pgTable("qa_turns", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer"),
  citations: jsonb("citations"),
  status: text("status").notNull(), // "pending" | "running" | "complete" | "error"
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type QaTurnRow = typeof qaTurns.$inferSelect;
export type NewQaTurnRow = typeof qaTurns.$inferInsert;

/**
 * Append-only audit log. One row per state-changing agent action
 * (ingestion, evaluation, synthesis, qa, rubric edit). The defensibility
 * surface — every agent's actions traceable to its model, tokens, latency,
 * resource, and outcome.
 */
export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  resourceKind: text("resource_kind"),
  resourceId: text("resource_id"),
  actor: text("actor").notNull(),
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms"),
  status: text("status"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;
