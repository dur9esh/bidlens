import { Type } from "@google/genai";

import { generateWithFallback, type ModelId } from "@/lib/ai";
import { getBids } from "@/lib/documents";
import { listEvaluations } from "@/lib/evaluation/dao";
import { getIngestion } from "@/lib/ingestion/dao";
import { getDefaultRubric } from "@/lib/rubric/dao";

import {
  comparativeSynthesisResultSchema,
  type ComparativeSynthesisResult,
  type VendorScoreSummary,
} from "./types";

const SYSTEM_PROMPT = `You are an expert procurement analyst producing a comparative analysis across multiple vendor bids in response to one RFP.

You will be given:
1. The RFP's structured ingestion (implicit in the per-vendor evaluations, which reference RFP context).
2. Each vendor's bid ingestion (structured data with citations).
3. Each vendor's three category evaluations (technical, commercial, compliance — with criterion scores, rationales, hard requirement check outcomes, and flags).
4. The rubric.
5. Pre-computed vendor score summaries (per-category weighted scores, overall weighted score, and hard-requirement failure counts — trust these, do not recompute).

Your job:
- Produce a side-by-side comparison: for each rubric criterion across all three categories, list the per-vendor score (as { vendor_id, score } entries) and a short comparative note on how they differ.
- Surface CROSS-VENDOR insights — things visible only when looking at all vendors together:
  - common_gap: criteria where NO vendor adequately addresses the RFP's expectation
  - standout_strength: a vendor's notable advantage relative to peers
  - standout_weakness: a vendor's notable disadvantage relative to peers
  - cross_vendor_risk: a risk that spans multiple vendors (e.g. all three have similar roadmap dependencies, or all three are growth-stage with continuity risk)
- Be especially alert to clauses that quietly preserve vendor rights — perpetual licenses to use customer data, vendor IP grants over derived outputs, joint ownership clauses — these are standout weaknesses even if they don't fail a hard requirement.
- Generate clarification questions to send back to specific vendors — questions that, if answered, would meaningfully change the procurement decision. Be concrete and actionable; cite the bid line that triggered the question.
- Rank vendors best-to-worst overall (return vendor_ids in order). Write a 3-5 sentence rationale that acknowledges hard-requirement failures explicitly. A vendor that fails a hard requirement is not necessarily disqualified — that's a buyer decision — but the failure must be surfaced and weighted heavily.
- Write a 3-5 sentence executive summary suitable for a procurement leader who needs to understand the landscape in one minute. Be calibrated and useful.

Be evidence-based. Carry citations through (page + verbatim_excerpt) where they meaningfully support your insights. Do not declare a winner without acknowledging trade-offs.

Output ONLY the JSON object matching the schema. No prose, no markdown fences.`;

const citationSchemaJson = {
  type: Type.OBJECT,
  properties: {
    page: { type: Type.INTEGER },
    verbatim_excerpt: { type: Type.STRING },
  },
  required: ["page", "verbatim_excerpt"],
};

const vendorScoreEntrySchemaJson = {
  type: Type.OBJECT,
  properties: {
    vendor_id: { type: Type.STRING },
    score: { type: Type.NUMBER, nullable: true },
  },
  required: ["vendor_id", "score"],
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vendor_score_summaries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          vendor_id: { type: Type.STRING },
          vendor_name: { type: Type.STRING },
          technical_score: { type: Type.NUMBER, nullable: true },
          commercial_score: { type: Type.NUMBER, nullable: true },
          compliance_score: { type: Type.NUMBER, nullable: true },
          overall_weighted_score: { type: Type.NUMBER, nullable: true },
          hard_requirement_fail_count: { type: Type.INTEGER },
          failed_hard_requirements: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          "vendor_id",
          "vendor_name",
          "technical_score",
          "commercial_score",
          "compliance_score",
          "overall_weighted_score",
          "hard_requirement_fail_count",
          "failed_hard_requirements",
        ],
      },
    },
    ranking: { type: Type.ARRAY, items: { type: Type.STRING } },
    ranking_rationale: { type: Type.STRING },
    criterion_comparisons: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          criterion_id: { type: Type.STRING },
          criterion_name: { type: Type.STRING },
          category: {
            type: Type.STRING,
            enum: ["technical", "commercial", "compliance"],
          },
          scores_by_vendor: {
            type: Type.ARRAY,
            items: vendorScoreEntrySchemaJson,
          },
          comparative_note: { type: Type.STRING },
        },
        required: [
          "criterion_id",
          "criterion_name",
          "category",
          "scores_by_vendor",
          "comparative_note",
        ],
      },
    },
    insights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          kind: {
            type: Type.STRING,
            enum: [
              "common_gap",
              "standout_strength",
              "standout_weakness",
              "cross_vendor_risk",
            ],
          },
          vendor_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          title: { type: Type.STRING },
          detail: { type: Type.STRING },
          severity: {
            type: Type.STRING,
            enum: ["low", "medium", "high"],
            nullable: true,
          },
          citations: { type: Type.ARRAY, items: citationSchemaJson },
        },
        required: [
          "kind",
          "vendor_ids",
          "title",
          "detail",
          "severity",
          "citations",
        ],
      },
    },
    clarification_questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          vendor_id: { type: Type.STRING },
          vendor_name: { type: Type.STRING },
          question: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ["vendor_id", "vendor_name", "question", "reason"],
      },
    },
    executive_summary: { type: Type.STRING },
  },
  required: [
    "vendor_score_summaries",
    "ranking",
    "ranking_rationale",
    "criterion_comparisons",
    "insights",
    "clarification_questions",
    "executive_summary",
  ],
};

export interface ComparativeSynthesisRun {
  result: ComparativeSynthesisResult;
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/**
 * Pre-compute per-vendor score summaries deterministically from the stored
 * evaluation rows. The agent receives these as inputs and reasons about them
 * rather than recomputing — same principle as the TCO normalizer in PR 6 and
 * the compliance pre-checks in PR 7.
 */
export async function computeVendorScoreSummaries(): Promise<
  VendorScoreSummary[]
> {
  const bids = getBids();
  const rubric = await getDefaultRubric();
  const evaluations = await listEvaluations();

  const summaries: VendorScoreSummary[] = [];

  for (const bid of bids) {
    const techEval = evaluations.find(
      (e) => e.vendorId === bid.id && e.category === "technical"
    );
    const commEval = evaluations.find(
      (e) => e.vendorId === bid.id && e.category === "commercial"
    );
    const compEval = evaluations.find(
      (e) => e.vendorId === bid.id && e.category === "compliance"
    );

    const techScore = techEval?.result?.weighted_category_score ?? null;
    const commScore = commEval?.result?.weighted_category_score ?? null;
    const compScore = compEval?.result?.weighted_category_score ?? null;

    let overall: number | null = null;
    if (techScore != null && commScore != null && compScore != null) {
      const techWeight =
        rubric.content.categories.find((c) => c.id === "technical")?.weight ??
        0;
      const commWeight =
        rubric.content.categories.find((c) => c.id === "commercial")
          ?.weight ?? 0;
      const compWeight =
        rubric.content.categories.find((c) => c.id === "compliance")
          ?.weight ?? 0;
      const totalWeight = techWeight + commWeight + compWeight;
      if (totalWeight > 0) {
        overall =
          Math.round(
            ((techScore * techWeight +
              commScore * commWeight +
              compScore * compWeight) /
              totalWeight) *
              100
          ) / 100;
      }
    }

    const failedHrs: string[] = [];
    for (const e of [techEval, commEval, compEval]) {
      const checks = e?.result?.hard_requirement_checks ?? [];
      for (const chk of checks) {
        if (chk.outcome === "fail") failedHrs.push(chk.requirement_name);
      }
    }

    summaries.push({
      vendor_id: bid.id,
      vendor_name: bid.vendor ?? bid.title,
      technical_score: techScore,
      commercial_score: commScore,
      compliance_score: compScore,
      overall_weighted_score: overall,
      hard_requirement_fail_count: failedHrs.length,
      failed_hard_requirements: failedHrs,
    });
  }

  return summaries;
}

export async function runComparativeSynthesis(): Promise<ComparativeSynthesisRun> {
  const startedAt = Date.now();
  const bids = getBids();
  const rubric = await getDefaultRubric();
  const evaluations = await listEvaluations();

  // Validate prerequisites: every bid × every category must have a complete evaluation
  const missing: string[] = [];
  for (const bid of bids) {
    for (const cat of [
      "technical",
      "commercial",
      "compliance",
    ] as const) {
      const ev = evaluations.find(
        (e) =>
          e.vendorId === bid.id &&
          e.category === cat &&
          e.status === "complete"
      );
      if (!ev) missing.push(`${bid.vendor ?? bid.id} / ${cat}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Cannot run comparative synthesis — missing complete evaluations: ${missing.join(", ")}`
    );
  }

  const summaries = await computeVendorScoreSummaries();

  const bidIngestions = await Promise.all(bids.map((b) => getIngestion(b.id)));
  const bidsForAgent = bids.map((b, i) => ({
    vendor_id: b.id,
    vendor_name: b.vendor ?? b.title,
    ingestion: bidIngestions[i]?.result ?? null,
  }));

  const evaluationsForAgent = bids.map((b) => ({
    vendor_id: b.id,
    vendor_name: b.vendor ?? b.title,
    technical: evaluations.find(
      (e) => e.vendorId === b.id && e.category === "technical"
    )?.result,
    commercial: evaluations.find(
      (e) => e.vendorId === b.id && e.category === "commercial"
    )?.result,
    compliance: evaluations.find(
      (e) => e.vendorId === b.id && e.category === "compliance"
    )?.result,
  }));

  const userPrompt = `## RUBRIC
${JSON.stringify(rubric.content, null, 2)}

## VENDOR BIDS (structured ingestions)
${JSON.stringify(bidsForAgent, null, 2)}

## PER-VENDOR CATEGORY EVALUATIONS
${JSON.stringify(evaluationsForAgent, null, 2)}

## PRE-COMPUTED VENDOR SCORE SUMMARIES (trust these — do not recompute)
${JSON.stringify(summaries, null, 2)}

Produce the comparative synthesis. Return the JSON object.`;

  const fb = await generateWithFallback("synthesis", {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 32768,
      thinkingConfig: { thinkingBudget: 8192 },
    },
  });

  if (fb.finishReason === "MAX_TOKENS") {
    throw new Error(
      "Comparative synthesis output truncated (finishReason=MAX_TOKENS). Raise maxOutputTokens or lower thinkingBudget."
    );
  }
  if (!fb.text) {
    throw new Error("Synthesis returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fb.text);
  } catch {
    throw new Error(
      `Synthesis did not return valid JSON. First 300 chars: ${fb.text.slice(0, 300)}`
    );
  }

  const result = comparativeSynthesisResultSchema.parse(parsed);

  // Override the agent's score summaries with the deterministic ones —
  // the agent's job is reasoning, not arithmetic.
  result.vendor_score_summaries = summaries;

  return {
    result,
    model: fb.modelUsed,
    inputTokens: fb.inputTokens,
    outputTokens: fb.outputTokens,
    latencyMs: Date.now() - startedAt,
  };
}
