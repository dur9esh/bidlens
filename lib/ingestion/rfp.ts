import { readFile } from "node:fs/promises";
import path from "node:path";

import { getClaude, MODELS } from "@/lib/claude";
import {
  rfpIngestionResultSchema,
  type RfpIngestionResult,
} from "./types";

const SYSTEM_PROMPT = `You are an expert procurement analyst. You will receive an RFP document and must extract its structure into the provided tool call.

Rules:
- Be faithful to the source. Do not invent requirements or evaluation criteria the RFP does not state.
- Every claim you make must include a citation: a verbatim excerpt (under 200 characters) of the exact text in the RFP that supports it, plus its approximate page number.
- A hard requirement is a must-pass criterion the buyer marks with language like "required", "must", or that the document explicitly disqualifies vendors for failing to meet. Distinguish hard requirements from weighted preferences ("strongly preferred", "favorable").
- Be specific. "Vendors must execute the buyer's BAA template" beats "compliance is required".

You must call the record_rfp_ingestion tool exactly once with the structured result.`;

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
  name: "record_rfp_ingestion",
  description: "Records the structured ingestion of an RFP document.",
  input_schema: {
    type: "object" as const,
    properties: {
      buyer_name: { type: "string" },
      rfp_number: { type: "string" },
      product_scope_summary: {
        type: "string",
        description: "A 1-3 sentence summary of what the buyer is procuring.",
      },
      evaluation_criteria_summary: claimSchemaJson,
      hard_requirements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "A stable kebab-case ID, e.g. 'baa-template'.",
            },
            name: { type: "string" },
            description: { type: "string" },
            is_hard_requirement: { type: "boolean" },
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
  },
};

export interface RfpIngestionRunResult {
  result: RfpIngestionResult;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export async function ingestRfp(
  filename: string
): Promise<RfpIngestionRunResult> {
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
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: "tool", name: "record_rfp_ingestion" },
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
            text: "Please ingest this RFP document into the record_rfp_ingestion tool.",
          },
        ],
      },
    ],
  });

  const toolUseBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("Model did not return a tool_use block");
  }

  const parsed = rfpIngestionResultSchema.parse(toolUseBlock.input);

  return {
    result: parsed,
    model: MODELS.SONNET,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    latencyMs: Date.now() - startedAt,
  };
}
