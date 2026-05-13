import { readFile } from "node:fs/promises";
import path from "node:path";

import { getClaude, MODELS } from "@/lib/claude";
import {
  bidIngestionResultSchema,
  type BidIngestionResult,
} from "./types";

const SYSTEM_PROMPT = `You are an expert procurement analyst. You will receive a vendor's bid response to an RFP and must extract its content into the provided tool call.

Rules:
- Be faithful to the source. Do not invent capabilities, prices, or commitments the bid does not state.
- Every claim you make must include a citation: a verbatim excerpt (under 200 characters) of the exact text in the bid that supports it, plus its approximate page number.
- Where a field is not addressed in the bid, use null (for numbers/booleans) or the appropriate enum value (e.g. "unknown").
- Surface notable contractual clauses verbatim — especially anything that diverges from typical buyer expectations on IP ownership, data retention, auto-renewal, or model training.
- Be precise on pricing math. If the bid states a per-provider monthly rate and a provider count, compute the annual subscription total; cite the relevant text.

You must call the record_bid_ingestion tool exactly once with the structured result.`;

const citationSchemaJson = {
  type: "object" as const,
  properties: {
    page: { type: "integer", minimum: 1 },
    verbatim_excerpt: { type: "string", maxLength: 200 },
  },
  required: ["page", "verbatim_excerpt"],
};

const claimSchemaJson = {
  type: "object" as const,
  properties: {
    text: { type: "string" },
    citations: {
      type: "array",
      items: citationSchemaJson,
      minItems: 1,
    },
  },
  required: ["text", "citations"],
};

const TOOL_DEFINITION = {
  name: "record_bid_ingestion",
  description: "Records the structured ingestion of a vendor bid document.",
  input_schema: {
    type: "object" as const,
    properties: {
      vendor_name: { type: "string" },
      submission_date: {
        type: ["string", "null"],
        description: "ISO date string if discoverable, else null.",
      },
      company_overview: {
        type: "string",
        description: "1-2 sentence summary of the vendor's positioning.",
      },
      technical: {
        type: "object",
        properties: {
          epic_integration_available: { type: ["boolean", "null"] },
          cerner_integration_available: { type: ["boolean", "null"] },
          cerner_integration_roadmap: { type: ["string", "null"] },
          ambient_capture_latency_seconds_median: { type: ["number", "null"] },
          english_capture_available: { type: ["boolean", "null"] },
          spanish_capture_available: { type: ["boolean", "null"] },
          spanish_capture_roadmap: { type: ["string", "null"] },
          additional_languages: { type: "array", items: { type: "string" } },
          specialty_coverage_summary: claimSchemaJson,
          mobile_platforms: {
            type: "array",
            items: { type: "string", enum: ["ios", "android", "web"] },
          },
          sso_providers: { type: "array", items: { type: "string" } },
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
        type: "object",
        properties: {
          subscription_per_provider_per_month_usd: {
            type: ["number", "null"],
          },
          annual_subscription_total_usd: { type: ["number", "null"] },
          implementation_one_time_usd: { type: ["number", "null"] },
          annual_support_usd: { type: ["number", "null"] },
          three_year_total_contract_value_usd: { type: ["number", "null"] },
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
        type: "object",
        properties: {
          initial_term_years: { type: ["number", "null"] },
          auto_renewal_term_years: { type: ["number", "null"] },
          price_escalation_percent_per_year: { type: ["number", "null"] },
          non_renewal_notice_days: { type: ["number", "null"] },
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
        type: "object",
        properties: {
          hipaa_compliant: { type: ["boolean", "null"] },
          baa_template_acceptance: {
            type: "string",
            enum: [
              "accepts_buyer_template",
              "vendor_template_only",
              "flexible_with_review",
              "unknown",
            ],
          },
          soc2_type_ii_status: {
            type: "string",
            enum: ["current", "in_progress", "none", "unknown"],
          },
          hitrust_r2_status: {
            type: "string",
            enum: ["certified", "in_progress", "roadmap", "none", "unknown"],
          },
          us_only_phi_residency: { type: ["boolean", "null"] },
          model_training_data_handling: {
            type: "string",
            enum: ["opt_in_only", "opt_out_default", "always_uses", "unknown"],
          },
          encryption_at_rest: { type: ["string", "null"] },
          encryption_in_transit: { type: ["string", "null"] },
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
      references: { type: "array", items: claimSchemaJson },
      data_ownership_terms: claimSchemaJson,
      notable_clauses: { type: "array", items: claimSchemaJson },
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
  },
};

export interface BidIngestionRunResult {
  result: BidIngestionResult;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export async function ingestBid(
  filename: string
): Promise<BidIngestionRunResult> {
  const startedAt = Date.now();
  const claude = getClaude();
  const filePath = path.join(
    process.cwd(),
    "public",
    "demo-bids",
    filename
  );
  const fileBuffer = await readFile(filePath);
  const fileBase64 = fileBuffer.toString("base64");

  const response = await claude.messages.create({
    model: MODELS.SONNET,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: "tool", name: "record_bid_ingestion" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: fileBase64,
            },
          },
          {
            type: "text",
            text: "Please ingest this vendor bid into the record_bid_ingestion tool.",
          },
        ],
      },
    ],
  });

  const toolUseBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("Model did not return a tool_use block");
  }

  const parsed = bidIngestionResultSchema.parse(toolUseBlock.input);

  return {
    result: parsed,
    model: MODELS.SONNET,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs: Date.now() - startedAt,
  };
}
