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

export interface GeminiEvaluationRun {
  result: CategoryEvaluationResult;
  /** The model that actually served the request (may be a fallback). */
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/**
 * Shared Gemini call for category evaluators. Goes through the fallback chain
 * in lib/ai.ts. The caller builds the prompts and passes the Zod parser.
 */
export async function runEvaluationAgent(args: {
  systemPrompt: string;
  userPrompt: string;
  responseSchema: object;
  zodParse: (raw: unknown) => CategoryEvaluationResult;
}): Promise<GeminiEvaluationRun> {
  const startedAt = Date.now();

  const fb = await generateWithFallback({
    contents: [{ role: "user", parts: [{ text: args.userPrompt }] }],
    config: {
      systemInstruction: args.systemPrompt,
      responseMimeType: "application/json",
      responseSchema: args.responseSchema,
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

  return {
    result,
    model: fb.modelUsed,
    inputTokens: fb.inputTokens,
    outputTokens: fb.outputTokens,
    latencyMs: Date.now() - startedAt,
  };
}
