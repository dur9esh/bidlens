import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
