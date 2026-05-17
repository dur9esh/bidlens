import type { Category, HardRequirement } from "@/lib/rubric/types";
import type {
  BidIngestionResult,
  RfpIngestionResult,
} from "@/lib/ingestion/types";

import { categoryEvaluationResultSchema } from "./types";
import {
  EVALUATION_RESPONSE_SCHEMA,
  loadEvaluatorInputs,
  recomputeWeightedScore,
  runEvaluationAgent,
  type GeminiEvaluationRun,
} from "./shared";
import { computeTco, type TcoBreakdown } from "./tco";

/** Hard requirement ids from the rubric that the Commercial Evaluator owns. */
const COMMERCIAL_HARD_REQUIREMENT_IDS = ["hr-renewal-1yr"];

const SYSTEM_PROMPT = `You are an expert commercial procurement evaluator for healthcare software. You assess the commercial terms of a vendor's bid: total cost of ownership, contract flexibility, cost transparency, and pricing model fit.

You will be given:
1. The RFP's commercial context and expectations.
2. The vendor's bid — already extracted into structured data with citations.
3. A pre-computed, normalized 3-year TCO breakdown for this vendor (computed deterministically, on consistent assumptions across all vendors — trust these numbers for cost reasoning).
4. A rubric: the commercial category, its weighted criteria, and the commercial hard requirements.

Your job:
- Score each rubric criterion on a 1-10 scale (1 = severely deficient, 4 = partially meets, 7 = meets, 10 = exceeds). Be calibrated and evidence-based.
- CRITICAL CONSTRAINT: hard_requirement_checks MUST contain entries ONLY for these exact requirement_id values: "hr-renewal-1yr". Do NOT create checks for any other requirement_id. The response schema enforces this with an enum. Concerns that fall outside this specific ID must be surfaced as flags with severity low/medium/high.
- For TCO scoring, reason about the pre-computed normalized TCO — do not recompute it yourself. A lower normalized TCO is generally better, but weigh it against what the vendor delivers.
- For contract flexibility, scrutinize: initial term, auto-renewal length, price escalation, termination rights, non-renewal notice burden. Terms that diverge from the RFP's stated expectations should cost points and should be surfaced as flags.
- For each score, write a 2-4 sentence rationale grounded in the bid's actual content and the normalized TCO.
- Carry citations through from the bid's structured data where they support your scoring.
- Check each commercial hard requirement: pass / fail / unclear, with rationale and citation.
- Surface commercial risks as flags with severity low / medium / high — e.g. auto-renewal longer than the RFP allows, escalation above the RFP's cap, burdensome non-renewal notice, hidden costs. This includes any concerns you might be tempted to record as hard-requirement checks but that are not in the explicit hard-requirements input — those go here as flags.
- Compute a weighted_category_score (criterion scores weighted by the rubric's criterion weights, 0-10).

Output ONLY the JSON object matching the schema. No prose, no markdown fences.`;

function buildUserPrompt(args: {
  rfp: RfpIngestionResult;
  bid: BidIngestionResult;
  category: Category;
  hardRequirements: HardRequirement[];
  tco: TcoBreakdown;
}): string {
  return `## RFP COMMERCIAL CONTEXT
${JSON.stringify(args.rfp, null, 2)}

## VENDOR BID (structured)
${JSON.stringify(args.bid, null, 2)}

## NORMALIZED 3-YEAR TCO (pre-computed, deterministic — trust these numbers)
${JSON.stringify(args.tco, null, 2)}

## RUBRIC — COMMERCIAL CATEGORY
${JSON.stringify(args.category, null, 2)}

## COMMERCIAL HARD REQUIREMENTS
${JSON.stringify(args.hardRequirements, null, 2)}

Evaluate this vendor's commercial fit. Score every criterion in the rubric category. Check every hard requirement listed. Return the JSON object.`;
}

export async function evaluateCommercial(
  vendorDocumentId: string
): Promise<GeminiEvaluationRun> {
  const inputs = await loadEvaluatorInputs(vendorDocumentId, "commercial");

  const commercialHardRequirements =
    inputs.rubric.content.hardRequirements.filter((hr) =>
      COMMERCIAL_HARD_REQUIREMENT_IDS.includes(hr.id)
    );

  // Deterministic TCO normalization — code, not LLM. The agent reasons about
  // the resulting numbers; arithmetic stays here.
  const tco = computeTco(inputs.bid);

  const userPrompt = buildUserPrompt({
    rfp: inputs.rfp,
    bid: inputs.bid,
    category: inputs.category,
    hardRequirements: commercialHardRequirements,
    tco,
  });

  const run = await runEvaluationAgent({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    responseSchema: EVALUATION_RESPONSE_SCHEMA,
    zodParse: (raw) => categoryEvaluationResultSchema.parse(raw),
    allowedHardRequirementIds: COMMERCIAL_HARD_REQUIREMENT_IDS,
  });

  // Server-side integrity check: recompute the weighted score, override the
  // agent's arithmetic with our own.
  run.result.weighted_category_score = recomputeWeightedScore(
    run.result.criterion_scores,
    inputs.category
  );

  // Attach the deterministic TCO breakdown to the persisted result so the UI
  // can render it in the commercial scorecard.
  run.result.tco_breakdown = tco;

  return run;
}
