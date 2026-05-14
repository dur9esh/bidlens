import { Type } from "@google/genai";

import type { Category, HardRequirement } from "@/lib/rubric/types";
import type {
  BidIngestionResult,
  RfpIngestionResult,
} from "@/lib/ingestion/types";

import {
  categoryEvaluationResultSchema,
} from "./types";
import {
  loadEvaluatorInputs,
  recomputeWeightedScore,
  runEvaluationAgent,
  type GeminiEvaluationRun,
} from "./shared";

/** Hard requirement ids from the rubric that the Technical Evaluator owns. */
const TECHNICAL_HARD_REQUIREMENT_IDS = ["hr-epic", "hr-en-es-capture"];

const SYSTEM_PROMPT = `You are an expert technical procurement evaluator for healthcare software. You assess how well a vendor's bid meets the technical requirements of an RFP.

You will be given:
1. The RFP's technical context and requirements.
2. The vendor's bid — already extracted into structured data with citations.
3. A rubric: the technical category, its weighted criteria, and the technical hard requirements.

Your job:
- Score each rubric criterion on a 1-10 scale (1 = severely deficient, 4 = partially meets, 7 = meets, 10 = exceeds). Be calibrated and evidence-based — do not inflate scores.
- For each score, write a 2-4 sentence rationale grounded in the bid's actual content.
- Carry citations through: when the bid's structured data includes a citation that supports your scoring, include it. Citations are {page, verbatim_excerpt} objects from the bid.
- Check each technical hard requirement: pass / fail / unclear, with a rationale and citation.
- Surface technical gaps and risks as flags with severity low / medium / high.
- Compute a weighted_category_score (the criterion scores weighted by the rubric's criterion weights, 0-10).
- Be fair but rigorous. A vendor that only has Epic integration when the RFP strongly prefers Epic AND Cerner should score well on the hard requirement (Epic is present) but lose points on the criterion (Cerner depth is weak).

Output ONLY the JSON object matching the schema. No prose, no markdown fences.`;

const citationSchemaJson = {
  type: Type.OBJECT,
  properties: {
    page: { type: Type.INTEGER },
    verbatim_excerpt: { type: Type.STRING },
  },
  required: ["page", "verbatim_excerpt"],
};

const RESPONSE_SCHEMA = {
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

function buildUserPrompt(args: {
  rfp: RfpIngestionResult;
  bid: BidIngestionResult;
  category: Category;
  hardRequirements: HardRequirement[];
}): string {
  return `## RFP TECHNICAL CONTEXT
${JSON.stringify(args.rfp, null, 2)}

## VENDOR BID (structured)
${JSON.stringify(args.bid, null, 2)}

## RUBRIC — TECHNICAL CATEGORY
${JSON.stringify(args.category, null, 2)}

## TECHNICAL HARD REQUIREMENTS
${JSON.stringify(args.hardRequirements, null, 2)}

Evaluate this vendor's technical fit. Score every criterion in the rubric category. Check every hard requirement listed. Return the JSON object.`;
}

export async function evaluateTechnical(
  vendorDocumentId: string
): Promise<GeminiEvaluationRun> {
  const inputs = await loadEvaluatorInputs(vendorDocumentId, "technical");

  const technicalHardRequirements = inputs.rubric.content.hardRequirements.filter(
    (hr) => TECHNICAL_HARD_REQUIREMENT_IDS.includes(hr.id)
  );

  const userPrompt = buildUserPrompt({
    rfp: inputs.rfp,
    bid: inputs.bid,
    category: inputs.category,
    hardRequirements: technicalHardRequirements,
  });

  const run = await runEvaluationAgent({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    responseSchema: RESPONSE_SCHEMA,
    zodParse: (raw) => categoryEvaluationResultSchema.parse(raw),
  });

  // Server-side integrity check: recompute the weighted score, override the
  // agent's arithmetic with our own.
  const recomputed = recomputeWeightedScore(
    run.result.criterion_scores,
    inputs.category
  );
  run.result.weighted_category_score = recomputed;

  return run;
}
