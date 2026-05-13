import { type RubricContent } from "./types";

export const DEFAULT_RUBRIC_NAME =
  "Midwest Regional Health — Ambient Documentation RFP";
export const DEFAULT_RUBRIC_DESCRIPTION =
  "Default scoring rubric matched to MRH-RFP-2026-014. Three weighted categories plus eight hard requirements that gate scoring.";

export const DEFAULT_RUBRIC_CONTENT: RubricContent = {
  categories: [
    {
      id: "technical",
      name: "Technical",
      weight: 40,
      description:
        "How well the vendor's solution meets MRH's technical requirements: EHR integration, ambient capture quality, note quality, language support, and identity/device coverage.",
      criteria: [
        {
          id: "ehr-integration",
          name: "EHR integration depth",
          description:
            "Depth and maturity of integration with Epic Hyperdrive (required) and Oracle Cerner Millennium (strongly preferred). FHIR usage, embedded experience, write-back fidelity.",
          weight: 25,
        },
        {
          id: "ambient-capture",
          name: "Ambient capture quality and latency",
          description:
            "Quality of ambient audio capture without dictation, latency from encounter end to draft note, and clinician device support.",
          weight: 25,
        },
        {
          id: "note-quality",
          name: "Note quality and specialty coverage",
          description:
            "Specialty-aware note formatting depth across primary care, medical and surgical specialties, and behavioral health.",
          weight: 25,
        },
        {
          id: "language-support",
          name: "Language support",
          description:
            "Ambient capture support across required languages (English, Spanish at minimum) and additional languages relevant to MRH's patient mix.",
          weight: 15,
        },
        {
          id: "mobile-identity",
          name: "Mobile, identity, and access",
          description:
            "Native iOS and Android applications, SSO via Microsoft Entra ID, and EHR-embedded experience.",
          weight: 10,
        },
      ],
    },
    {
      id: "commercial",
      name: "Commercial",
      weight: 30,
      description:
        "Total cost of ownership, contract flexibility, and transparency on implementation and ongoing costs.",
      criteria: [
        {
          id: "tco-3yr",
          name: "Three-year total cost of ownership",
          description:
            "Normalized three-year TCO across the 3,500-provider footprint, inclusive of subscription, implementation, integration, and support fees.",
          weight: 40,
        },
        {
          id: "contract-flexibility",
          name: "Contract flexibility",
          description:
            "Initial term, renewal terms, auto-renewal length, price escalation caps, termination rights, and non-renewal notice periods.",
          weight: 35,
        },
        {
          id: "implementation-transparency",
          name: "Implementation cost transparency",
          description:
            "Clarity and inclusiveness of implementation and integration fees, with no material hidden costs.",
          weight: 15,
        },
        {
          id: "pricing-model-fit",
          name: "Pricing model fit",
          description:
            "Alignment of the proposed pricing model (per-provider, per-encounter, hybrid) to MRH's preferred consumption pattern.",
          weight: 10,
        },
      ],
    },
    {
      id: "compliance",
      name: "Compliance",
      weight: 30,
      description:
        "Regulatory compliance posture, contractual data-handling protections, and audit readiness.",
      criteria: [
        {
          id: "hipaa-baa",
          name: "HIPAA and BAA terms",
          description:
            "HIPAA Privacy and Security Rule compliance plus willingness to execute MRH's standard BAA template without material modification.",
          weight: 35,
        },
        {
          id: "soc2-hitrust",
          name: "SOC 2 and HITRUST status",
          description:
            "Current SOC 2 Type II attestation (required) and HITRUST CSF r2 certification (strongly preferred).",
          weight: 25,
        },
        {
          id: "data-residency",
          name: "Data residency",
          description:
            "All PHI stored within the contiguous United States, with documented primary and disaster-recovery regions.",
          weight: 15,
        },
        {
          id: "model-training-terms",
          name: "Model training data terms",
          description:
            "Vendor commitment that customer PHI is not used to train, fine-tune, or improve models without explicit, written, opt-in consent.",
          weight: 15,
        },
        {
          id: "audit-incident-response",
          name: "Audit and incident response",
          description:
            "Customer access to audit logs and time-bounded breach notification commitments.",
          weight: 10,
        },
      ],
    },
  ],
  hardRequirements: [
    {
      id: "hr-baa",
      name: "Executed BAA on MRH template",
      description:
        "Vendor commits to execute MRH's standard Business Associate Agreement (Exhibit B) without material modification.",
      enabled: true,
    },
    {
      id: "hr-hipaa",
      name: "HIPAA Privacy and Security Rule compliance",
      description:
        "Vendor attests to full HIPAA Privacy and Security Rule compliance.",
      enabled: true,
    },
    {
      id: "hr-soc2",
      name: "SOC 2 Type II attestation",
      description:
        "Current SOC 2 Type II attestation completed within the prior twelve months.",
      enabled: true,
    },
    {
      id: "hr-us-residency",
      name: "US-only PHI residency",
      description:
        "All PHI processed and stored exclusively within the contiguous United States.",
      enabled: true,
    },
    {
      id: "hr-opt-in-training",
      name: "Opt-in model training",
      description:
        "Vendor does not use MRH PHI to train models without explicit, written, opt-in consent for each specific use.",
      enabled: true,
    },
    {
      id: "hr-epic",
      name: "Epic Hyperdrive integration",
      description:
        "Bi-directional integration with Epic Hyperdrive available at contract start.",
      enabled: true,
    },
    {
      id: "hr-en-es-capture",
      name: "English and Spanish ambient capture",
      description:
        "Ambient capture support available at contract start in both English and Spanish.",
      enabled: true,
    },
    {
      id: "hr-renewal-1yr",
      name: "Auto-renewal capped at one year",
      description: "No automatic renewal term longer than one year.",
      enabled: true,
    },
  ],
  scoringScale: {
    min: 1,
    max: 10,
    description:
      "1 = severely deficient · 4 = partially meets requirement · 7 = meets requirement · 10 = exceeds requirement",
  },
};
