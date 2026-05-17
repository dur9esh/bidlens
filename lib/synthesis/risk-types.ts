import { z } from "zod";

import { citationSchema } from "@/lib/ingestion/types";

export const riskCategoryEnum = z.enum([
  "contractual",
  "compliance",
  "data_handling",
  "technical_capability",
  "vendor_viability",
  "implementation",
  "operational",
  "other",
]);
export type RiskCategory = z.infer<typeof riskCategoryEnum>;

export const riskItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: riskCategoryEnum,
  severity: z.enum(["low", "medium", "high"]),
  likelihood: z.enum(["low", "medium", "high"]),
  /** Vendor ids the risk affects; empty for class-level risks that span all vendors. */
  affected_vendor_ids: z.array(z.string()),
  affected_vendor_names: z.array(z.string()),
  description: z.string(),
  citations: z.array(citationSchema),
  recommended_mitigation: z.string(),
  owner_suggestion: z.string(),
});
export type RiskItem = z.infer<typeof riskItemSchema>;

export const riskRegisterSchema = z.object({
  generated_at: z.string(),
  rfp_reference: z.string(),
  summary: z.string(),
  risks: z.array(riskItemSchema),
});
export type RiskRegister = z.infer<typeof riskRegisterSchema>;
