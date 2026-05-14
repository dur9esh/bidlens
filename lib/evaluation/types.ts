import { z } from "zod";

import { citationSchema } from "@/lib/ingestion/types";

/** A single scored criterion within a category evaluation. */
export const criterionScoreSchema = z.object({
  /** Matches the criterion id from the rubric (e.g. "ehr-integration"). */
  criterion_id: z.string(),
  /** Display name, copied from the rubric for convenience. */
  criterion_name: z.string(),
  /** Score on the rubric's 1-10 scale. */
  score: z.number().min(1).max(10),
  /** 2-4 sentence explanation of the score. */
  rationale: z.string(),
  /**
   * Citations into the bid text that justify the score. May be empty only if
   * the bid is silent on this criterion.
   */
  citations: z.array(citationSchema),
});
export type CriterionScore = z.infer<typeof criterionScoreSchema>;

/** Result of checking one hard requirement against a bid. */
export const hardRequirementCheckSchema = z.object({
  /** Matches the hard requirement id from the rubric (e.g. "hr-epic"). */
  requirement_id: z.string(),
  requirement_name: z.string(),
  outcome: z.enum(["pass", "fail", "unclear"]),
  rationale: z.string(),
  /** Citation into the bid text supporting the outcome. Null if the bid is entirely silent. */
  citation: citationSchema.nullable(),
});
export type HardRequirementCheck = z.infer<typeof hardRequirementCheckSchema>;

/** A notable gap, weakness, or risk surfaced during evaluation. */
export const evaluationFlagSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  summary: z.string(),
  citation: citationSchema.nullable(),
});
export type EvaluationFlag = z.infer<typeof evaluationFlagSchema>;

/**
 * The full result of one category evaluation for one vendor.
 * Shared shape across technical / commercial / compliance evaluators.
 */
export const categoryEvaluationResultSchema = z.object({
  vendor_name: z.string(),
  category: z.enum(["technical", "commercial", "compliance"]),
  criterion_scores: z.array(criterionScoreSchema),
  /**
   * Weighted 0-10 score for the category, computed from criterion scores and
   * the rubric's criterion weights. The agent computes this; we also recompute
   * it server-side as an integrity check (see shared.ts).
   */
  weighted_category_score: z.number().min(0).max(10),
  hard_requirement_checks: z.array(hardRequirementCheckSchema),
  flags: z.array(evaluationFlagSchema),
  /** 2-3 sentence overall summary of the vendor in this category. */
  category_summary: z.string(),
});
export type CategoryEvaluationResult = z.infer<
  typeof categoryEvaluationResultSchema
>;
