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
