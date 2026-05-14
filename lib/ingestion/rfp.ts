import { readFile } from "node:fs/promises";
import path from "node:path";

import { Type } from "@google/genai";

import { generateWithFallback, type ModelId } from "@/lib/ai";
import {
  rfpIngestionResultSchema,
  type RfpIngestionResult,
} from "./types";

const SYSTEM_PROMPT = `You are an expert procurement analyst. You will receive an RFP document and must extract its structure as JSON matching the provided schema.

Rules:
- Be faithful to the source. Do not invent requirements or evaluation criteria the RFP does not state.
- Every claim must include at least one citation: a verbatim excerpt (under 500 characters) of the exact text in the RFP that supports it, plus its approximate page number (1-indexed).
- A hard requirement is a must-pass criterion the buyer marks with language like "required", "must", or that the document explicitly disqualifies vendors for failing. Distinguish hard requirements from weighted preferences ("strongly preferred", "favorable").
- Be specific. "Vendors must execute the buyer's BAA template" beats "compliance is required".
- Output ONLY the JSON object. No prose, no markdown fences.`;

const citationSchemaJson = {
  type: Type.OBJECT,
  properties: {
    page: { type: Type.INTEGER },
    verbatim_excerpt: { type: Type.STRING },
  },
  required: ["page", "verbatim_excerpt"],
};

const claimSchemaJson = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING },
    citations: {
      type: Type.ARRAY,
      items: citationSchemaJson,
    },
  },
  required: ["text", "citations"],
};

// JSON Schema for Gemini's responseSchema. Mirrors rfpIngestionResultSchema in
// types.ts. Zod remains the source of truth and the runtime guarantee.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    buyer_name: { type: Type.STRING },
    rfp_number: { type: Type.STRING },
    product_scope_summary: { type: Type.STRING },
    evaluation_criteria_summary: claimSchemaJson,
    hard_requirements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          is_hard_requirement: { type: Type.BOOLEAN },
          citation: citationSchemaJson,
        },
        required: [
          "id",
          "name",
          "description",
          "is_hard_requirement",
          "citation",
        ],
      },
    },
    commercial_expectations: claimSchemaJson,
    contract_term_expectations: claimSchemaJson,
    data_handling_expectations: claimSchemaJson,
  },
  required: [
    "buyer_name",
    "rfp_number",
    "product_scope_summary",
    "evaluation_criteria_summary",
    "hard_requirements",
    "commercial_expectations",
    "contract_term_expectations",
    "data_handling_expectations",
  ],
};

export interface RfpIngestionRunResult {
  result: RfpIngestionResult;
  /** The model that actually served the request (may be a fallback). */
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export async function ingestRfp(
  filename: string
): Promise<RfpIngestionRunResult> {
  const startedAt = Date.now();
  const filePath = path.join(
    process.cwd(),
    "public",
    "demo-bids",
    filename
  );
  const fileBuffer = await readFile(filePath);
  const fileBase64 = fileBuffer.toString("base64");

  const fb = await generateWithFallback({
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: fileBase64,
            },
          },
          {
            text: "Ingest this RFP document into JSON matching the schema.",
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 32768,
      thinkingConfig: { thinkingBudget: 2048 },
    },
  });

  if (fb.finishReason === "MAX_TOKENS") {
    throw new Error(
      "RFP ingestion output was truncated (finishReason=MAX_TOKENS). Raise `maxOutputTokens` and/or lower `thinkingBudget` in lib/ingestion/rfp.ts."
    );
  }

  if (!fb.text) {
    throw new Error("Gemini returned an empty response.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fb.text);
  } catch {
    throw new Error(
      `Gemini did not return valid JSON. First 300 chars: ${fb.text.slice(0, 300)}`
    );
  }

  // Zod is the runtime guarantee. If Gemini's output drifts, this throws.
  const result = rfpIngestionResultSchema.parse(parsedJson);

  return {
    result,
    model: fb.modelUsed,
    inputTokens: fb.inputTokens,
    outputTokens: fb.outputTokens,
    latencyMs: Date.now() - startedAt,
  };
}
