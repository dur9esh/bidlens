import type { Category, HardRequirement } from "@/lib/rubric/types";
import type {
  BidIngestionResult,
  RfpIngestionResult,
} from "@/lib/ingestion/types";

import {
  precheckComplianceHardRequirements,
  type DeterministicHardReqResult,
} from "./compliance-checks";
import { categoryEvaluationResultSchema } from "./types";
import {
  EVALUATION_RESPONSE_SCHEMA,
  loadEvaluatorInputs,
  recomputeWeightedScore,
  runEvaluationAgent,
  type GeminiEvaluationRun,
} from "./shared";

/** Hard requirement ids from the rubric that the Compliance Evaluator owns. */
const COMPLIANCE_HARD_REQUIREMENT_IDS = [
  "hr-baa",
  "hr-hipaa",
  "hr-soc2",
  "hr-us-residency",
  "hr-opt-in-training",
];

const SYSTEM_PROMPT = `You are an expert compliance evaluator for healthcare software procurement. You assess a vendor's regulatory and contractual data-handling posture: HIPAA, BAA terms, SOC 2 + HITRUST status, data residency, model training data terms, and audit + incident response readiness.

You will be given:
1. The RFP's compliance context and expectations.
2. The vendor's bid — already extracted into structured data with citations.
3. Deterministic pre-checks for the compliance hard requirements (computed in code from the bid's typed enums — these are the basis; refine with rationale and citation rather than reinventing).
4. A rubric: the compliance category, its weighted criteria, and the compliance hard requirements.

Your job:
- Score each rubric criterion on a 1-10 scale (1 = severely deficient, 4 = partially meets, 7 = meets, 10 = exceeds). Be calibrated and evidence-based.
- CRITICAL CONSTRAINT: hard_requirement_checks MUST contain entries ONLY for these exact requirement_id values: "hr-baa", "hr-hipaa", "hr-soc2", "hr-us-residency", "hr-opt-in-training". Do NOT create checks for any other requirement_id. The response schema enforces this with an enum. Concerns that fall outside these specific IDs (e.g. data ownership terms, audio retention, exportability) must be surfaced as flags with severity low/medium/high.
- For each score, write a 2-4 sentence rationale grounded in the bid's content.
- Carry citations through from the bid's structured data.
- For each compliance hard requirement: take the deterministic pre-check outcome as the basis, write a clear rationale, and attach a citation from the bid text. Only override the outcome if you see explicit, important nuance in the bid that the enum missed — and if you do override, explain why.
- Surface compliance risks as flags with severity low / medium / high. Anything that diverges from the RFP's stated requirements is a flag. Roadmap-dependent compliance (e.g. SOC 2 "in progress") is a flag. Data-handling clauses that quietly preserve vendor rights — perpetual licenses to use customer PHI or de-identified data, vendor IP grants over derived outputs — are flags. This includes any concerns you might be tempted to record as hard-requirement checks but that are not in the explicit hard-requirements input — those go here as flags.
- Compute a weighted_category_score (criterion scores weighted by the rubric's criterion weights, 0-10).

Output ONLY the JSON object matching the schema. No prose, no markdown fences.`;

function buildUserPrompt(args: {
  rfp: RfpIngestionResult;
  bid: BidIngestionResult;
  category: Category;
  hardRequirements: HardRequirement[];
  prechecks: DeterministicHardReqResult[];
}): string {
  return `## RFP COMPLIANCE CONTEXT
${JSON.stringify(args.rfp, null, 2)}

## VENDOR BID (structured)
${JSON.stringify(args.bid, null, 2)}

## DETERMINISTIC HARD REQUIREMENT PRE-CHECKS (computed in code from typed ingestion data)
${JSON.stringify(args.prechecks, null, 2)}

## RUBRIC — COMPLIANCE CATEGORY
${JSON.stringify(args.category, null, 2)}

## COMPLIANCE HARD REQUIREMENTS
${JSON.stringify(args.hardRequirements, null, 2)}

Evaluate this vendor's compliance posture. Score every criterion. For each hard requirement, take the pre-check as the basis and produce the final outcome with rationale and citation. Return the JSON object.`;
}

export async function evaluateCompliance(
  vendorDocumentId: string
): Promise<GeminiEvaluationRun> {
  const inputs = await loadEvaluatorInputs(vendorDocumentId, "compliance");

  const complianceHardRequirements =
    inputs.rubric.content.hardRequirements.filter((hr) =>
      COMPLIANCE_HARD_REQUIREMENT_IDS.includes(hr.id)
    );

  // Deterministic pre-checks — code, not LLM.
  const prechecks = precheckComplianceHardRequirements(inputs.bid);

  const userPrompt = buildUserPrompt({
    rfp: inputs.rfp,
    bid: inputs.bid,
    category: inputs.category,
    hardRequirements: complianceHardRequirements,
    prechecks,
  });

  const run = await runEvaluationAgent({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    responseSchema: EVALUATION_RESPONSE_SCHEMA,
    zodParse: (raw) => categoryEvaluationResultSchema.parse(raw),
    allowedHardRequirementIds: COMPLIANCE_HARD_REQUIREMENT_IDS,
  });

  // Server-side integrity check: recompute the weighted score, override the
  // agent's arithmetic with our own.
  run.result.weighted_category_score = recomputeWeightedScore(
    run.result.criterion_scores,
    inputs.category
  );

  return run;
}
