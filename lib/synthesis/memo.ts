import { Type } from "@google/genai";

import { generateWithFallback, type ModelId } from "@/lib/ai";
import { getBids, getRfp } from "@/lib/documents";
import { listEvaluations } from "@/lib/evaluation/dao";
import { getIngestion } from "@/lib/ingestion/dao";
import { getDefaultRubric } from "@/lib/rubric/dao";

import { getSynthesis } from "./dao";
import { evaluationMemoSchema, type EvaluationMemo } from "./memo-types";

const SYSTEM_PROMPT = `You are an expert procurement analyst writing the formal evaluation memo for a healthcare RFP. The memo is the document the VP of Procurement (the approver) reads and signs to authorize vendor selection, and the document a compliance auditor may review years later to understand why the decision was made.

You will be given:
1. The RFP's structured ingestion.
2. Each vendor's bid ingestion.
3. Each vendor's three category evaluations (technical, commercial, compliance).
4. The comparative synthesis (ranking, insights, clarification questions, executive summary).
5. The rubric.

Your job:
- Produce a complete, defensible evaluation memo in well-structured prose. Procurement memos are READ — write for a human, not as bullet points dressed up as a doc.
- Lead with an executive summary: 3-5 sentences that let the approver grasp the recommendation and key trade-offs in 60 seconds.
- Make a clear recommendation. If no vendor cleanly satisfies the requirements, that itself is the recommendation — say so, and lay out the procurement team's options (e.g. "negotiate exceptions with Vendor X", "re-issue RFP", "proceed with conditions").
- Surface recommendation caveats explicitly. If the recommended vendor has high-severity flags or fails a hard requirement, the approver MUST see that prominently.
- Body sections should walk through: per-vendor analysis (one section per vendor), comparative trade-offs, key risks, recommended next steps. Use clear section headings.
- Embed citations in body prose where evidence matters. Every concrete claim about a vendor should be traceable. Citations are {page, verbatim_excerpt} pairs from bid documents.
- List open questions explicitly. These are items where buyer decision or vendor clarification is still needed before final selection.
- Include a signatures block — plain text, suitable for routing to a signature workflow (DocuSign, etc.).

Tone: professional, evidence-based, calibrated. NOT salesy, NOT mealy-mouthed. If a vendor has serious problems, say so plainly. If a vendor is genuinely strong on a dimension, say so. The reader is a senior executive who will respect directness.

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
    title: { type: Type.STRING },
    date: { type: Type.STRING },
    prepared_for: { type: Type.STRING },
    rfp_reference: { type: Type.STRING },
    executive_summary: { type: Type.STRING },
    recommendation: { type: Type.STRING },
    recommendation_caveats: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          heading: { type: Type.STRING },
          body: { type: Type.STRING },
          citations: {
            type: Type.ARRAY,
            items: citationSchemaJson,
          },
        },
        required: ["heading", "body", "citations"],
      },
    },
    open_questions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    signatures_block: { type: Type.STRING },
  },
  required: [
    "title",
    "date",
    "prepared_for",
    "rfp_reference",
    "executive_summary",
    "recommendation",
    "recommendation_caveats",
    "sections",
    "open_questions",
    "signatures_block",
  ],
};

export interface MemoRun {
  result: EvaluationMemo;
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export async function generateEvaluationMemo(): Promise<MemoRun> {
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

  // Prerequisite checks
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
      `Cannot generate memo — missing evaluations: ${missing.join(", ")}`
    );
  }
  if (!comparative || comparative.status !== "complete") {
    throw new Error(
      "Cannot generate memo — comparative synthesis must be complete first."
    );
  }
  if (!rfpIngestion || rfpIngestion.status !== "complete") {
    throw new Error("Cannot generate memo — RFP must be ingested first.");
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
${JSON.stringify(rfpIngestion.result, null, 2)}

## RUBRIC
${JSON.stringify(rubric.content, null, 2)}

## VENDOR BIDS
${JSON.stringify(bidsForAgent, null, 2)}

## PER-VENDOR EVALUATIONS
${JSON.stringify(evaluationsForAgent, null, 2)}

## COMPARATIVE SYNTHESIS
${JSON.stringify(comparative.result, null, 2)}

## DATE
${new Date().toISOString().slice(0, 10)}

## PREPARED FOR
VP Procurement, Midwest Regional Health

Write the formal evaluation memo. Return the JSON object.`;

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
      "Memo output truncated (finishReason=MAX_TOKENS). Raise maxOutputTokens or lower thinkingBudget."
    );
  }
  if (!fb.text) {
    throw new Error("Memo agent returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fb.text);
  } catch {
    throw new Error(
      `Memo did not return valid JSON. First 300 chars: ${fb.text.slice(0, 300)}`
    );
  }

  const result = evaluationMemoSchema.parse(parsed);

  return {
    result,
    model: fb.modelUsed,
    inputTokens: fb.inputTokens,
    outputTokens: fb.outputTokens,
    latencyMs: Date.now() - startedAt,
  };
}
