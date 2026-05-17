import { z } from "zod";

import { citationSchema } from "@/lib/ingestion/types";

export const qaAnswerCitationSchema = z.object({
  source_kind: z.enum([
    "rfp",
    "bid",
    "evaluation",
    "comparative_synthesis",
    "memo",
    "risk_register",
  ]),
  /** e.g. document id, evaluation id, synthesis kind. */
  source_id: z.string(),
  /** Human-readable label, e.g. "ScribeAI Health bid" or "DocuMind Compliance evaluation". */
  source_label: z.string(),
  /** Underlying bid-text citation if the answer is grounded in specific bid text. */
  bid_citation: citationSchema.nullable(),
  /** Short verbatim excerpt from the source supporting the claim (max ~300 chars). */
  excerpt: z.string(),
});
export type QaAnswerCitation = z.infer<typeof qaAnswerCitationSchema>;

export const qaAnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(qaAnswerCitationSchema),
});
export type QaAnswer = z.infer<typeof qaAnswerSchema>;
