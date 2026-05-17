import { z } from "zod";

import { citationSchema } from "@/lib/ingestion/types";

export const memoSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
  citations: z.array(citationSchema),
});
export type MemoSection = z.infer<typeof memoSectionSchema>;

export const evaluationMemoSchema = z.object({
  title: z.string(),
  /** ISO date string. */
  date: z.string(),
  prepared_for: z.string(),
  rfp_reference: z.string(),
  executive_summary: z.string(),
  recommendation: z.string(),
  recommendation_caveats: z.array(z.string()),
  sections: z.array(memoSectionSchema),
  open_questions: z.array(z.string()),
  signatures_block: z.string(),
});
export type EvaluationMemo = z.infer<typeof evaluationMemoSchema>;
