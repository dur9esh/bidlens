import { z } from "zod";

/**
 * A citation back to specific document text. Every claim the ingestion agent
 * makes carries one of these.
 */
export const citationSchema = z.object({
  /** Approximate page number (1-indexed) where the claim appears. */
  page: z.number().int().min(1),
  /**
   * Verbatim excerpt from the source document. Practical ceiling is 1500 chars;
   * anything longer is truncated with an ellipsis so a single long clause never
   * fails the whole ingestion.
   */
  verbatim_excerpt: z
    .string()
    .transform((s) => (s.length > 1500 ? s.slice(0, 1500) + "…" : s)),
});
export type Citation = z.infer<typeof citationSchema>;

/**
 * A single claim extracted from a document. Every claim is grounded by at
 * least one citation.
 */
export const claimSchema = z.object({
  text: z.string(),
  citations: z.array(citationSchema).min(1),
});
export type Claim = z.infer<typeof claimSchema>;

// ---------------------------------------------------------------------------
// RFP ingestion result
// ---------------------------------------------------------------------------

export const rfpRequirementSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  is_hard_requirement: z.boolean(),
  citation: citationSchema,
});
export type RfpRequirement = z.infer<typeof rfpRequirementSchema>;

export const rfpIngestionResultSchema = z.object({
  buyer_name: z.string(),
  rfp_number: z.string(),
  product_scope_summary: z.string(),
  evaluation_criteria_summary: claimSchema,
  hard_requirements: z.array(rfpRequirementSchema),
  commercial_expectations: claimSchema,
  contract_term_expectations: claimSchema,
  data_handling_expectations: claimSchema,
});
export type RfpIngestionResult = z.infer<typeof rfpIngestionResultSchema>;

// ---------------------------------------------------------------------------
// Bid ingestion result
// ---------------------------------------------------------------------------

export const bidPricingSchema = z.object({
  subscription_per_provider_per_month_usd: z.number().nullable(),
  annual_subscription_total_usd: z.number().nullable(),
  implementation_one_time_usd: z.number().nullable(),
  annual_support_usd: z.number().nullable(),
  three_year_total_contract_value_usd: z.number().nullable(),
  pricing_model_notes: claimSchema,
});
export type BidPricing = z.infer<typeof bidPricingSchema>;

export const bidContractTermsSchema = z.object({
  initial_term_years: z.number().nullable(),
  auto_renewal_term_years: z.number().nullable(),
  price_escalation_percent_per_year: z.number().nullable(),
  non_renewal_notice_days: z.number().nullable(),
  contract_terms_notes: claimSchema,
});
export type BidContractTerms = z.infer<typeof bidContractTermsSchema>;

export const bidComplianceSchema = z.object({
  hipaa_compliant: z.boolean().nullable(),
  baa_template_acceptance: z.enum([
    "accepts_buyer_template",
    "vendor_template_only",
    "flexible_with_review",
    "unknown",
  ]),
  soc2_type_ii_status: z.enum(["current", "in_progress", "none", "unknown"]),
  hitrust_r2_status: z.enum([
    "certified",
    "in_progress",
    "roadmap",
    "none",
    "unknown",
  ]),
  us_only_phi_residency: z.boolean().nullable(),
  model_training_data_handling: z.enum([
    "opt_in_only",
    "opt_out_default",
    "always_uses",
    "unknown",
  ]),
  encryption_at_rest: z.string().nullable(),
  encryption_in_transit: z.string().nullable(),
  compliance_notes: claimSchema,
});
export type BidCompliance = z.infer<typeof bidComplianceSchema>;

export const bidTechnicalSchema = z.object({
  epic_integration_available: z.boolean().nullable(),
  cerner_integration_available: z.boolean().nullable(),
  cerner_integration_roadmap: z.string().nullable(),
  ambient_capture_latency_seconds_median: z.number().nullable(),
  english_capture_available: z.boolean().nullable(),
  spanish_capture_available: z.boolean().nullable(),
  spanish_capture_roadmap: z.string().nullable(),
  additional_languages: z.array(z.string()),
  specialty_coverage_summary: claimSchema,
  mobile_platforms: z.array(z.enum(["ios", "android", "web"])),
  sso_providers: z.array(z.string()),
});
export type BidTechnical = z.infer<typeof bidTechnicalSchema>;

export const bidIngestionResultSchema = z.object({
  vendor_name: z.string(),
  submission_date: z.string().nullable(),
  company_overview: z.string(),
  technical: bidTechnicalSchema,
  pricing: bidPricingSchema,
  contract_terms: bidContractTermsSchema,
  compliance: bidComplianceSchema,
  references: z.array(claimSchema),
  data_ownership_terms: claimSchema,
  notable_clauses: z.array(claimSchema),
});
export type BidIngestionResult = z.infer<typeof bidIngestionResultSchema>;
