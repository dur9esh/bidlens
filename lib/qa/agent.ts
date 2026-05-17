import { Type } from "@google/genai";

import { generateWithFallback, type ModelId } from "@/lib/ai";
import { getBids, getRfp } from "@/lib/documents";
import { listEvaluations } from "@/lib/evaluation/dao";
import { getIngestion } from "@/lib/ingestion/dao";
import { getDefaultRubric } from "@/lib/rubric/dao";
import { getSynthesis } from "@/lib/synthesis/dao";

import { qaAnswerSchema, type QaAnswer } from "./types";

const SYSTEM_PROMPT = `You are an expert procurement analyst answering questions about a healthcare RFP evaluation. You have access to the full corpus: the RFP, each vendor's bid ingestion (structured data with citations), each vendor's category evaluations (technical, commercial, compliance), the comparative synthesis, the evaluation memo, and the risk register.

Your job:
- Answer the user's question grounded ONLY in the corpus provided. Do not speculate beyond what the documents and evaluations say.
- Every claim must carry at least one citation referencing the source it came from. Source kinds are: "rfp", "bid", "evaluation", "comparative_synthesis", "memo", "risk_register".
- For each citation, include a short verbatim excerpt (max ~300 chars) from the source that supports your claim. If your claim is grounded in specific bid text and the underlying bid ingestion already has a {page, verbatim_excerpt} citation, carry it through as bid_citation. Otherwise set bid_citation to null.
- If the corpus does NOT contain the information needed to answer, say so directly. Do not invent. Saying "the evaluation does not address this specific question" is a perfectly good answer.
- Keep answers concise — typically 2-5 sentences for simple questions, longer only when the question genuinely demands depth.
- Tone: professional, evidence-based, calibrated. Don't over-hedge, but don't overstate certainty either.

Output ONLY the JSON object matching the schema. No prose outside the JSON, no markdown fences.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    citations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          source_kind: {
            type: Type.STRING,
            enum: [
              "rfp",
              "bid",
              "evaluation",
              "comparative_synthesis",
              "memo",
              "risk_register",
            ],
          },
          source_id: { type: Type.STRING },
          source_label: { type: Type.STRING },
          bid_citation: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              page: { type: Type.INTEGER },
              verbatim_excerpt: { type: Type.STRING },
            },
            required: ["page", "verbatim_excerpt"],
          },
          excerpt: { type: Type.STRING },
        },
        required: [
          "source_kind",
          "source_id",
          "source_label",
          "bid_citation",
          "excerpt",
        ],
      },
    },
  },
  required: ["answer", "citations"],
};

export interface QaRun {
  result: QaAnswer;
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/**
 * Run the Q&A agent. Loads the full corpus once and passes it as context.
 * Routes through the `qa` model chain — flash-lite-led for low latency.
 */
export async function answerQuestion(
  question: string,
  recentTurns: { question: string; answer: string | null }[] = []
): Promise<QaRun> {
  const startedAt = Date.now();

  const bids = getBids();
  const rfp = getRfp();
  const [
    rubric,
    evaluations,
    comparative,
    memo,
    riskRegister,
    rfpIngestion,
    ...bidIngestions
  ] = await Promise.all([
    getDefaultRubric(),
    listEvaluations(),
    getSynthesis("comparative"),
    getSynthesis("memo"),
    getSynthesis("risk_register"),
    getIngestion(rfp.id),
    ...bids.map((b) => getIngestion(b.id)),
  ]);

  const bidsForAgent = bids.map((b, i) => ({
    vendor_id: b.id,
    vendor_name: b.vendor ?? b.title,
    ingestion: bidIngestions[i]?.result ?? null,
  }));

  const evaluationsForAgent = bids.map((b) => ({
    vendor_id: b.id,
    vendor_name: b.vendor ?? b.title,
    technical:
      evaluations.find(
        (e) => e.vendorId === b.id && e.category === "technical"
      )?.result ?? null,
    commercial:
      evaluations.find(
        (e) => e.vendorId === b.id && e.category === "commercial"
      )?.result ?? null,
    compliance:
      evaluations.find(
        (e) => e.vendorId === b.id && e.category === "compliance"
      )?.result ?? null,
  }));

  const conversationContext =
    recentTurns.length > 0
      ? `\n\n## RECENT CONVERSATION (most recent turns, for context only — answer the LATEST question)\n${JSON.stringify(recentTurns.slice(-3), null, 2)}`
      : "";

  const userPrompt = `## CORPUS

### RFP
${JSON.stringify(rfpIngestion?.result ?? null, null, 2)}

### RUBRIC
${JSON.stringify(rubric.content, null, 2)}

### VENDOR BIDS (structured)
${JSON.stringify(bidsForAgent, null, 2)}

### PER-VENDOR EVALUATIONS
${JSON.stringify(evaluationsForAgent, null, 2)}

### COMPARATIVE SYNTHESIS
${JSON.stringify(comparative?.result ?? null, null, 2)}

### EVALUATION MEMO
${JSON.stringify(memo?.result ?? null, null, 2)}

### RISK REGISTER
${JSON.stringify(riskRegister?.result ?? null, null, 2)}
${conversationContext}

## QUESTION
${question}

Answer grounded in the corpus only. Return the JSON object.`;

  const fb = await generateWithFallback("qa", {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 2048 },
    },
  });

  if (fb.finishReason === "MAX_TOKENS") {
    throw new Error(
      "Q&A output truncated (finishReason=MAX_TOKENS). Raise maxOutputTokens or lower thinkingBudget."
    );
  }
  if (!fb.text) {
    throw new Error("Q&A agent returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fb.text);
  } catch {
    throw new Error(
      `Q&A did not return valid JSON. First 300 chars: ${fb.text.slice(0, 300)}`
    );
  }

  const result = qaAnswerSchema.parse(parsed);

  return {
    result,
    model: fb.modelUsed,
    inputTokens: fb.inputTokens,
    outputTokens: fb.outputTokens,
    latencyMs: Date.now() - startedAt,
  };
}
