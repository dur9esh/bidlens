import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  DEFAULT_RUBRIC_CONTENT,
  DEFAULT_RUBRIC_DESCRIPTION,
  DEFAULT_RUBRIC_NAME,
} from "./defaults";
import { DEFAULT_RUBRIC_ID, type Rubric, type RubricContent } from "./types";

function rowToRubric(row: typeof schema.rubrics.$inferSelect): Rubric {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    content: row.content as RubricContent,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Get the default rubric, seeding it from defaults.ts on first call. */
export async function getDefaultRubric(): Promise<Rubric> {
  const existing = await db
    .select()
    .from(schema.rubrics)
    .where(eq(schema.rubrics.id, DEFAULT_RUBRIC_ID))
    .limit(1);

  if (existing.length > 0) {
    return rowToRubric(existing[0]);
  }

  const [inserted] = await db
    .insert(schema.rubrics)
    .values({
      id: DEFAULT_RUBRIC_ID,
      name: DEFAULT_RUBRIC_NAME,
      description: DEFAULT_RUBRIC_DESCRIPTION,
      content: DEFAULT_RUBRIC_CONTENT,
    })
    .returning();

  return rowToRubric(inserted);
}

/** Update a rubric's content (categories + hard requirements + scoring scale). */
export async function updateRubricContent(
  id: string,
  content: RubricContent
): Promise<Rubric> {
  const [updated] = await db
    .update(schema.rubrics)
    .set({ content, updatedAt: new Date() })
    .where(eq(schema.rubrics.id, id))
    .returning();

  if (!updated) {
    throw new Error(`Rubric ${id} not found`);
  }

  return rowToRubric(updated);
}
