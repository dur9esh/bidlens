import { readFile } from "node:fs/promises";
import path from "node:path";

import { Type } from "@google/genai";

import { generateWithFallback, type ModelId } from "@/lib/ai";
import {
  bidIngestionResultSchema,
  type BidIngestionResult,
} from "./types";

const SYSTEM_PROMPT = `You are an expert procurement analyst. You will receive a vendor's bid response to an RFP and must extract its content as JSON matching the provided schema.

Rules:
- Be faithful to the source. Do not invent capabilities, prices, or commitments the bid does not state.
- Every claim must include at least one citation: a verbatim excerpt (under 500 characters) of the exact text in the bid that supports it, plus its approximate page number (1-indexed).
- Where a field is not addressed in the bid, use null (for numbers/booleans/optional strings) or the appropriate enum value (e.g. "unknown").
- Surface notable contractual clauses verbatim — especially anything that diverges from typical buyer expectations on IP ownership, data retention, auto-renewal, or model training.
- Be precise on pricing math. If the bid states a per-provider monthly rate and a provider count, compute the annual subscription total; cite the relevant text.
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

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vendor_name: { type: Type.STRING },
    submission_date: { type: Type.STRING, nullable: true },
    company_overview: { type: Type.STRING },
    technical: {
      type: Type.OBJECT,
      properties: {
        epic_integration_available: { type: Type.BOOLEAN, nullable: true },
        cerner_integration_available: { type: Type.BOOLEAN, nullable: true },
        cerner_integration_roadmap: { type: Type.STRING, nullable: true },
        ambient_capture_latency_seconds_median: {
          type: Type.NUMBER,
          nullable: true,
        },
        english_capture_available: { type: Type.BOOLEAN, nullable: true },
        spanish_capture_available: { type: Type.BOOLEAN, nullable: true },
        spanish_capture_roadmap: { type: Type.STRING, nullable: true },
        additional_languages: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        specialty_coverage_summary: claimSchemaJson,
        mobile_platforms: {
          type: Type.ARRAY,
          items: { type: Type.STRING, enum: ["ios", "android", "web"] },
        },
        sso_providers: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        "epic_integration_available",
        "cerner_integration_available",
        "cerner_integration_roadmap",
        "ambient_capture_latency_seconds_median",
        "english_capture_available",
        "spanish_capture_available",
        "spanish_capture_roadmap",
        "additional_languages",
        "specialty_coverage_summary",
        "mobile_platforms",
        "sso_providers",
      ],
    },
    pricing: {
      type: Type.OBJECT,
      properties: {
        subscription_per_provider_per_month_usd: {
          type: Type.NUMBER,
          nullable: true,
        },
        annual_subscription_total_usd: { type: Type.NUMBER, nullable: true },
        implementation_one_time_usd: { type: Type.NUMBER, nullable: true },
        annual_support_usd: { type: Type.NUMBER, nullable: true },
        three_year_total_contract_value_usd: {
          type: Type.NUMBER,
          nullable: true,
        },
        pricing_model_notes: claimSchemaJson,
      },
      required: [
        "subscription_per_provider_per_month_usd",
        "annual_subscription_total_usd",
        "implementation_one_time_usd",
        "annual_support_usd",
        "three_year_total_contract_value_usd",
        "pricing_model_notes",
      ],
    },
    contract_terms: {
      type: Type.OBJECT,
      properties: {
        initial_term_years: { type: Type.NUMBER, nullable: true },
        auto_renewal_term_years: { type: Type.NUMBER, nullable: true },
        price_escalation_percent_per_year: {
          type: Type.NUMBER,
          nullable: true,
        },
        non_renewal_notice_days: { type: Type.NUMBER, nullable: true },
        contract_terms_notes: claimSchemaJson,
      },
      required: [
        "initial_term_years",
        "auto_renewal_term_years",
        "price_escalation_percent_per_year",
        "non_renewal_notice_days",
        "contract_terms_notes",
      ],
    },
    compliance: {
      type: Type.OBJECT,
      properties: {
        hipaa_compliant: { type: Type.BOOLEAN, nullable: true },
        baa_template_acceptance: {
          type: Type.STRING,
          enum: [
            "accepts_buyer_template",
            "vendor_template_only",
            "flexible_with_review",
            "unknown",
          ],
        },
        soc2_type_ii_status: {
          type: Type.STRING,
          enum: ["current", "in_progress", "none", "unknown"],
        },
        hitrust_r2_status: {
          type: Type.STRING,
          enum: ["certified", "in_progress", "roadmap", "none", "unknown"],
        },
        us_only_phi_residency: { type: Type.BOOLEAN, nullable: true },
        model_training_data_handling: {
          type: Type.STRING,
          enum: ["opt_in_only", "opt_out_default", "always_uses", "unknown"],
        },
        encryption_at_rest: { type: Type.STRING, nullable: true },
        encryption_in_transit: { type: Type.STRING, nullable: true },
        compliance_notes: claimSchemaJson,
      },
      required: [
        "hipaa_compliant",
        "baa_template_acceptance",
        "soc2_type_ii_status",
        "hitrust_r2_status",
        "us_only_phi_residency",
        "model_training_data_handling",
        "encryption_at_rest",
        "encryption_in_transit",
        "compliance_notes",
      ],
    },
    references: { type: Type.ARRAY, items: claimSchemaJson },
    data_ownership_terms: claimSchemaJson,
    notable_clauses: { type: Type.ARRAY, items: claimSchemaJson },
  },
  required: [
    "vendor_name",
    "submission_date",
    "company_overview",
    "technical",
    "pricing",
    "contract_terms",
    "compliance",
    "references",
    "data_ownership_terms",
    "notable_clauses",
  ],
};

export interface BidIngestionRunResult {
  result: BidIngestionResult;
  /** The model that actually served the request (may be a fallback). */
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export async function ingestBid(
  filename: string
): Promise<BidIngestionRunResult> {
  const startedAt = Date.now();
  const filePath = path.join(
    process.cwd(),
    "public",
    "demo-bids",
    filename
  );
  const fileBuffer = await readFile(filePath);
  const fileBase64 = fileBuffer.toString("base64");

  const fb = await generateWithFallback("ingestion", {
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
            text: "Ingest this vendor bid into JSON matching the schema.",
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
      "Bid ingestion output was truncated (finishReason=MAX_TOKENS). Raise `maxOutputTokens` and/or lower `thinkingBudget` in lib/ingestion/bid.ts."
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
  const result = bidIngestionResultSchema.parse(parsedJson);

  return {
    result,
    model: fb.modelUsed,
    inputTokens: fb.inputTokens,
    outputTokens: fb.outputTokens,
    latencyMs: Date.now() - startedAt,
  };
}
