import { Type } from "@google/genai";

import { generateWithFallback, type ModelId } from "@/lib/ai";
import { getBids, getRfp } from "@/lib/documents";
import { listEvaluations } from "@/lib/evaluation/dao";
import { getIngestion } from "@/lib/ingestion/dao";
import { getDefaultRubric } from "@/lib/rubric/dao";

import { getSynthesis } from "./dao";
import { riskRegisterSchema, type RiskRegister } from "./risk-types";

const SYSTEM_PROMPT = `You are an expert procurement risk analyst building a formal risk register for a healthcare RFP evaluation. The risk register lists everything that could go wrong in the vendor selection or downstream implementation, with severity, likelihood, citations, and recommended mitigations. The audience is the procurement, legal, and risk teams.

You will be given the RFP, the rubric, vendor bid ingestions, per-vendor evaluations, and the comparative synthesis.

Your job:
- Identify discrete, actionable risks. Each risk gets a category, severity (low/medium/high), likelihood (low/medium/high), affected vendor(s), description, citations, and recommended mitigation.
- A risk can be vendor-specific (e.g., "ClinicalNote.ai's SOC 2 attestation is still in progress") or cross-vendor (e.g., "All three vendors are growth-stage venture-funded; vendor continuity is a class-level risk").
- Categories: contractual, compliance, data_handling, technical_capability, vendor_viability, implementation, operational, other. Use them consistently.
- Severity reflects business impact if the risk materializes. Likelihood reflects how probable it is based on bid evidence. Both calibrated, not inflated.
- Recommended mitigation must be CONCRETE and actionable — "negotiate auto-renewal cap to 12 months in MSA" beats "address contractual gap".
- Owner suggestion identifies which team typically owns mitigation — Procurement, Legal, IT Security, Clinical Informatics, Risk, etc.
- Citations required for every risk. {page, verbatim_excerpt} pairs from bid documents.
- 8-15 risks total is typical. Quality over quantity. Do not pad.
- affected_vendor_ids: leave empty if the risk applies regardless of vendor selection. Otherwise list the vendor_ids it affects.

Output ONLY the JSON object matching the schema. No prose outside the JSON, no markdown fences.`;

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
    generated_at: { type: Type.STRING },
    rfp_reference: { type: Type.STRING },
    summary: { type: Type.STRING },
    risks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          category: {
            type: Type.STRING,
            enum: [
              "contractual",
              "compliance",
              "data_handling",
              "technical_capability",
              "vendor_viability",
              "implementation",
              "operational",
              "other",
            ],
          },
          severity: {
            type: Type.STRING,
            enum: ["low", "medium", "high"],
          },
          likelihood: {
            type: Type.STRING,
            enum: ["low", "medium", "high"],
          },
          affected_vendor_ids: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          affected_vendor_names: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          description: { type: Type.STRING },
          citations: { type: Type.ARRAY, items: citationSchemaJson },
          recommended_mitigation: { type: Type.STRING },
          owner_suggestion: { type: Type.STRING },
        },
        required: [
          "id",
          "title",
          "category",
          "severity",
          "likelihood",
          "affected_vendor_ids",
          "affected_vendor_names",
          "description",
          "citations",
          "recommended_mitigation",
          "owner_suggestion",
        ],
      },
    },
  },
  required: ["generated_at", "rfp_reference", "summary", "risks"],
};

export interface RiskRegisterRun {
  result: RiskRegister;
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export async function generateRiskRegister(): Promise<RiskRegisterRun> {
  const startedAt = Date.now();

  const bids = getBids();
  const rfp = getRfp();
  const [rubric, evaluations, comparative, rfpIngestion, ...bidIngestions] =
    await Promise.all([
      getDefaultRubric(),
      listEvaluations(),
      getSynthesis("comparative"),
      getIngestion(rfp.id),
      ...bids.map((b) => getIngestion(b.id)),
    ]);

  const missing: string[] = [];
  for (const bid of bids) {
    for (const cat of ["technical", "commercial", "compliance"] as const) {
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
      `Cannot generate risk register — missing evaluations: ${missing.join(", ")}`
    );
  }
  if (!comparative || comparative.status !== "complete") {
    throw new Error(
      "Cannot generate risk register — comparative synthesis must be complete first."
    );
  }

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

  const userPrompt = `## RFP
${JSON.stringify(rfpIngestion?.result, null, 2)}

## RUBRIC
${JSON.stringify(rubric.content, null, 2)}

## VENDOR BIDS
${JSON.stringify(bidsForAgent, null, 2)}

## PER-VENDOR EVALUATIONS
${JSON.stringify(evaluationsForAgent, null, 2)}

## COMPARATIVE SYNTHESIS
${JSON.stringify(comparative.result, null, 2)}

## GENERATED AT
${new Date().toISOString()}

Build the risk register. Return the JSON object.`;

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
      "Risk register output truncated (finishReason=MAX_TOKENS). Raise maxOutputTokens or lower thinkingBudget."
    );
  }
  if (!fb.text) {
    throw new Error("Risk register agent returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fb.text);
  } catch {
    throw new Error(
      `Risk register did not return valid JSON. First 300 chars: ${fb.text.slice(0, 300)}`
    );
  }

  const result = riskRegisterSchema.parse(parsed);

  return {
    result,
    model: fb.modelUsed,
    inputTokens: fb.inputTokens,
    outputTokens: fb.outputTokens,
    latencyMs: Date.now() - startedAt,
  };
}
