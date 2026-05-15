import { z } from "zod";

import { citationSchema } from "@/lib/ingestion/types";

/** Per-vendor score in a side-by-side criterion comparison. Used in an array
 * rather than a record-keyed object because Gemini's responseSchema doesn't
 * reliably support `additionalProperties`. */
export const vendorScoreEntrySchema = z.object({
  vendor_id: z.string(),
  score: z.number().nullable(),
});
export type VendorScoreEntry = z.infer<typeof vendorScoreEntrySchema>;

/** One vendor's row in the comparative scorecard. */
export const vendorScoreSummarySchema = z.object({
  vendor_id: z.string(),
  vendor_name: z.string(),
  technical_score: z.number().nullable(),
  commercial_score: z.number().nullable(),
  compliance_score: z.number().nullable(),
  /** Overall weighted score across the 3 categories using rubric weights. Recomputed server-side. */
  overall_weighted_score: z.number().nullable(),
  /** Total number of hard-requirement failures across all 3 category evaluations. */
  hard_requirement_fail_count: z.number().int().min(0),
  /** Display names of failed hard requirements (for the dashboard pill). */
  failed_hard_requirements: z.array(z.string()),
});
export type VendorScoreSummary = z.infer<typeof vendorScoreSummarySchema>;

/** A criterion shown side-by-side across vendors. */
export const criterionComparisonSchema = z.object({
  criterion_id: z.string(),
  criterion_name: z.string(),
  category: z.enum(["technical", "commercial", "compliance"]),
  /** Array of {vendor_id, score} entries for each vendor. */
  scores_by_vendor: z.array(vendorScoreEntrySchema),
  /** Short observation about how vendors compare on this criterion. */
  comparative_note: z.string(),
});
export type CriterionComparison = z.infer<typeof criterionComparisonSchema>;

/** A gap or strength surfaced across vendors. */
export const insightSchema = z.object({
  kind: z.enum([
    "common_gap",
    "standout_strength",
    "standout_weakness",
    "cross_vendor_risk",
  ]),
  /** Vendor(s) the insight applies to. Empty for common gaps that apply to all. */
  vendor_ids: z.array(z.string()),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["low", "medium", "high"]).nullable(),
  citations: z.array(citationSchema),
});
export type Insight = z.infer<typeof insightSchema>;

/** A question to send back to a specific vendor. */
export const clarificationQuestionSchema = z.object({
  vendor_id: z.string(),
  vendor_name: z.string(),
  question: z.string(),
  reason: z.string(),
});
export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;

export const comparativeSynthesisResultSchema = z.object({
  vendor_score_summaries: z.array(vendorScoreSummarySchema),
  /** vendor_ids ordered best to worst overall. */
  ranking: z.array(z.string()),
  ranking_rationale: z.string(),
  criterion_comparisons: z.array(criterionComparisonSchema),
  insights: z.array(insightSchema),
  clarification_questions: z.array(clarificationQuestionSchema),
  executive_summary: z.string(),
});
export type ComparativeSynthesisResult = z.infer<
  typeof comparativeSynthesisResultSchema
>;
