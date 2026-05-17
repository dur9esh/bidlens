import { Type } from "@google/genai";

import { generateWithFallback, type ModelId } from "@/lib/ai";
import { getDocument, getRfp } from "@/lib/documents";
import { getIngestion } from "@/lib/ingestion/dao";
import type {
  BidIngestionResult,
  RfpIngestionResult,
} from "@/lib/ingestion/types";
import { getDefaultRubric } from "@/lib/rubric/dao";
import type { Category, Rubric } from "@/lib/rubric/types";

import type {
  CategoryEvaluationResult,
  CriterionScore,
} from "./types";

export interface EvaluatorInputs {
  rubric: Rubric;
  category: Category;
  rfp: RfpIngestionResult;
  bid: BidIngestionResult;
  vendorDocumentId: string;
}

/**
 * Loads everything an evaluator agent needs: the rubric category, the RFP
 * ingestion, and the vendor bid ingestion. Throws clear errors if any
 * prerequisite ingestion is missing.
 */
export async function loadEvaluatorInputs(
  vendorDocumentId: string,
  categoryId: "technical" | "commercial" | "compliance"
): Promise<EvaluatorInputs> {
  const doc = getDocument(vendorDocumentId);
  if (!doc || doc.kind !== "bid") {
    throw new Error(`${vendorDocumentId} is not a vendor bid document`);
  }

  const rubric = await getDefaultRubric();
  const category = rubric.content.categories.find((c) => c.id === categoryId);
  if (!category) {
    throw new Error(`Rubric has no "${categoryId}" category`);
  }

  const rfpDoc = getRfp();
  const rfpIngestion = await getIngestion(rfpDoc.id);
  if (
    !rfpIngestion ||
    rfpIngestion.status !== "complete" ||
    !rfpIngestion.result
  ) {
    throw new Error("RFP has not been ingested yet. Ingest the RFP first.");
  }

  const bidIngestion = await getIngestion(vendorDocumentId);
  if (
    !bidIngestion ||
    bidIngestion.status !== "complete" ||
    !bidIngestion.result
  ) {
    throw new Error(
      `${doc.vendor ?? doc.title} bid has not been ingested yet. Ingest it first.`
    );
  }

  return {
    rubric,
    category,
    rfp: rfpIngestion.result as RfpIngestionResult,
    bid: bidIngestion.result as BidIngestionResult,
    vendorDocumentId,
  };
}

/**
 * Recompute the weighted category score from criterion scores + rubric weights.
 * Server-side integrity check — we trust this over the agent's own arithmetic.
 * Criterion weights within a category sum to 100; result is 0-10.
 */
export function recomputeWeightedScore(
  criterionScores: CriterionScore[],
  category: { criteria: { id: string; weight: number }[] }
): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const cs of criterionScores) {
    const criterion = category.criteria.find(
      (c) => c.id === cs.criterion_id
    );
    if (!criterion) continue;
    weightedSum += cs.score * criterion.weight;
    weightTotal += criterion.weight;
  }
  if (weightTotal === 0) return 0;
  // criterion.weight is a percentage; weightedSum/weightTotal yields a 1-10 number.
  return Math.round((weightedSum / weightTotal) * 100) / 100;
}

/**
 * JSON Schema for Gemini's responseSchema — shared output contract for all
 * three category evaluators (technical / commercial / compliance). Mirrors
 * categoryEvaluationResultSchema in types.ts; Zod remains the runtime guarantee.
 */
const citationSchemaJson = {
  type: Type.OBJECT,
  properties: {
    page: { type: Type.INTEGER },
    verbatim_excerpt: { type: Type.STRING },
  },
  required: ["page", "verbatim_excerpt"],
};

export const EVALUATION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vendor_name: { type: Type.STRING },
    category: {
      type: Type.STRING,
      enum: ["technical", "commercial", "compliance"],
    },
    criterion_scores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          criterion_id: { type: Type.STRING },
          criterion_name: { type: Type.STRING },
          score: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
          citations: {
            type: Type.ARRAY,
            items: citationSchemaJson,
          },
        },
        required: [
          "criterion_id",
          "criterion_name",
          "score",
          "rationale",
          "citations",
        ],
      },
    },
    weighted_category_score: { type: Type.NUMBER },
    hard_requirement_checks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          requirement_id: { type: Type.STRING },
          requirement_name: { type: Type.STRING },
          outcome: {
            type: Type.STRING,
            enum: ["pass", "fail", "unclear"],
          },
          rationale: { type: Type.STRING },
          citation: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              page: { type: Type.INTEGER },
              verbatim_excerpt: { type: Type.STRING },
            },
            required: ["page", "verbatim_excerpt"],
          },
        },
        required: [
          "requirement_id",
          "requirement_name",
          "outcome",
          "rationale",
          "citation",
        ],
      },
    },
    flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          severity: { type: Type.STRING, enum: ["low", "medium", "high"] },
          summary: { type: Type.STRING },
          citation: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              page: { type: Type.INTEGER },
              verbatim_excerpt: { type: Type.STRING },
            },
            required: ["page", "verbatim_excerpt"],
          },
        },
        required: ["severity", "summary", "citation"],
      },
    },
    category_summary: { type: Type.STRING },
  },
  required: [
    "vendor_name",
    "category",
    "criterion_scores",
    "weighted_category_score",
    "hard_requirement_checks",
    "flags",
    "category_summary",
  ],
};

export interface GeminiEvaluationRun {
  result: CategoryEvaluationResult;
  /** The model that actually served the request (may be a fallback). */
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  /** IDs the model produced but were dropped by the post-process filter. */
  dropped_invalid_requirement_ids: string[];
}

/**
 * Shared Gemini call for category evaluators. Goes through the fallback chain
 * in lib/ai.ts. Enforces the rubric-bounded hard-requirement constraint THREE
 * ways:
 *   1. The system prompt (written by each evaluator) says it.
 *   2. If `allowedHardRequirementIds` is provided, the response schema's
 *      `requirement_id` field is narrowed to an enum of those IDs.
 *   3. After parsing, any `hard_requirement_check` whose `requirement_id`
 *      isn't in the allowed list is dropped from the result.
 *
 * Defense in depth: prompt + schema + code all enforce the same rule, so the
 * agent literally cannot produce out-of-rubric hard requirements.
 */
export async function runEvaluationAgent(args: {
  systemPrompt: string;
  userPrompt: string;
  responseSchema: object;
  zodParse: (raw: unknown) => CategoryEvaluationResult;
  allowedHardRequirementIds?: string[];
}): Promise<GeminiEvaluationRun> {
  const startedAt = Date.now();

  // Narrow the response schema's requirement_id to an enum of the allowed IDs
  // when provided. Deep clone first — don't mutate the caller's constant.
  let effectiveSchema: object = args.responseSchema;
  if (
    args.allowedHardRequirementIds &&
    args.allowedHardRequirementIds.length > 0
  ) {
    const cloned = JSON.parse(JSON.stringify(args.responseSchema));
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schemaAny = cloned as any;
      schemaAny.properties.hard_requirement_checks.items.properties.requirement_id =
        {
          type: "string",
          enum: args.allowedHardRequirementIds,
        };
    } catch (e) {
      console.warn(
        "[runEvaluationAgent] Could not inject enum into responseSchema:",
        e
      );
    }
    effectiveSchema = cloned;
  }

  const fb = await generateWithFallback("evaluation", {
    contents: [{ role: "user", parts: [{ text: args.userPrompt }] }],
    config: {
      systemInstruction: args.systemPrompt,
      responseMimeType: "application/json",
      responseSchema: effectiveSchema,
      maxOutputTokens: 32768,
      thinkingConfig: { thinkingBudget: 4096 },
    },
  });

  if (fb.finishReason === "MAX_TOKENS") {
    throw new Error(
      "Evaluation output was truncated (finishReason=MAX_TOKENS). Raise `maxOutputTokens` and/or lower `thinkingBudget` in lib/evaluation/shared.ts."
    );
  }

  if (!fb.text) {
    throw new Error("Gemini returned an empty evaluation response.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fb.text);
  } catch {
    throw new Error(
      `Evaluator did not return valid JSON. First 300 chars: ${fb.text.slice(0, 300)}`
    );
  }

  const result = args.zodParse(parsedJson);

  // Post-process safety net: drop any hard_requirement_checks whose ID is
  // outside the allowed list, even if the model bypassed the schema enum.
  const dropped: string[] = [];
  if (
    args.allowedHardRequirementIds &&
    args.allowedHardRequirementIds.length > 0
  ) {
    const allowed = new Set(args.allowedHardRequirementIds);
    const before = result.hard_requirement_checks.length;
    result.hard_requirement_checks = result.hard_requirement_checks.filter(
      (chk) => {
        if (allowed.has(chk.requirement_id)) return true;
        dropped.push(chk.requirement_id);
        return false;
      }
    );
    if (dropped.length > 0) {
      console.warn(
        `[runEvaluationAgent] Dropped ${dropped.length} out-of-rubric hard requirement checks: ${dropped.join(", ")} (kept ${result.hard_requirement_checks.length}/${before})`
      );
    }
  }

  return {
    result,
    model: fb.modelUsed,
    inputTokens: fb.inputTokens,
    outputTokens: fb.outputTokens,
    latencyMs: Date.now() - startedAt,
    dropped_invalid_requirement_ids: dropped,
  };
}
