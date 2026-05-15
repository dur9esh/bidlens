import type { BidIngestionResult } from "@/lib/ingestion/types";

export type HardReqOutcome = "pass" | "fail" | "unclear";

export interface DeterministicHardReqResult {
  requirement_id: string;
  outcome: HardReqOutcome;
  /** Human-readable reason, e.g. "soc2_type_ii_status = 'in_progress'". */
  basis: string;
}

/**
 * Deterministic pre-check of compliance hard requirements against the bid's
 * structured ingestion data. The outcomes are based on typed enum values that
 * the ingestion agent already extracted with citations.
 *
 * The evaluator agent receives these as inputs and uses them as the basis for
 * its final hard-requirement checks — refining the rationale, attaching
 * citations, and only overriding the outcome with explicit justification if
 * the bid text reveals nuance the enum missed.
 */
export function precheckComplianceHardRequirements(
  bid: BidIngestionResult
): DeterministicHardReqResult[] {
  const c = bid.compliance;
  const results: DeterministicHardReqResult[] = [];

  // hr-baa: vendor accepts MRH's standard BAA template
  results.push({
    requirement_id: "hr-baa",
    outcome:
      c.baa_template_acceptance === "accepts_buyer_template"
        ? "pass"
        : c.baa_template_acceptance === "vendor_template_only"
          ? "fail"
          : "unclear",
    basis: `baa_template_acceptance = '${c.baa_template_acceptance}'`,
  });

  // hr-hipaa: HIPAA Privacy and Security Rule compliance
  results.push({
    requirement_id: "hr-hipaa",
    outcome:
      c.hipaa_compliant === true
        ? "pass"
        : c.hipaa_compliant === false
          ? "fail"
          : "unclear",
    basis: `hipaa_compliant = ${c.hipaa_compliant}`,
  });

  // hr-soc2: SOC 2 Type II attestation current
  results.push({
    requirement_id: "hr-soc2",
    outcome:
      c.soc2_type_ii_status === "current"
        ? "pass"
        : c.soc2_type_ii_status === "none" ||
            c.soc2_type_ii_status === "in_progress"
          ? "fail"
          : "unclear",
    basis: `soc2_type_ii_status = '${c.soc2_type_ii_status}'`,
  });

  // hr-us-residency: All PHI in contiguous United States
  results.push({
    requirement_id: "hr-us-residency",
    outcome:
      c.us_only_phi_residency === true
        ? "pass"
        : c.us_only_phi_residency === false
          ? "fail"
          : "unclear",
    basis: `us_only_phi_residency = ${c.us_only_phi_residency}`,
  });

  // hr-opt-in-training: Customer PHI not used for model training without explicit opt-in
  results.push({
    requirement_id: "hr-opt-in-training",
    outcome:
      c.model_training_data_handling === "opt_in_only"
        ? "pass"
        : c.model_training_data_handling === "opt_out_default" ||
            c.model_training_data_handling === "always_uses"
          ? "fail"
          : "unclear",
    basis: `model_training_data_handling = '${c.model_training_data_handling}'`,
  });

  return results;
}
