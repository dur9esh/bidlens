export type DocumentKind = "rfp" | "bid";

export interface DemoDocument {
  /** URL slug and lookup key. Used in routes like /documents/[id]. */
  id: string;
  /** Filename in /public/demo-bids/ (no leading slash). */
  filename: string;
  /** Display title shown in cards and document header. */
  title: string;
  /** Short subtitle / context line under the title. */
  subtitle: string;
  /** "rfp" for the buyer's RFP, "bid" for vendor responses. */
  kind: DocumentKind;
  /** For bids, the vendor name. Undefined for the RFP. */
  vendor?: string;
  /** 1-2 sentence summary of the document, for the card view. */
  summary: string;
  /** Page count (matches the PDF). */
  pageCount: number;
  /** Approximate size in KB (rounded). */
  sizeKb: number;
  /** ISO date string for the document. */
  date: string;
}

export const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    id: "rfp",
    filename: "rfp.pdf",
    title: "Request for Proposal — Ambient Clinical Documentation",
    subtitle: "Midwest Regional Health · MRH-RFP-2026-014",
    kind: "rfp",
    summary:
      "Midwest Regional Health's RFP for an AI-powered ambient clinical documentation platform. Covers technical, compliance, and commercial requirements; defines hard requirements and weighted evaluation criteria (technical 40% · commercial 30% · compliance 30%).",
    pageCount: 6,
    sizeKb: 14,
    date: "2026-02-17",
  },
  {
    id: "scribeai-bid",
    filename: "scribeai-bid.pdf",
    title: "ScribeAI Health — Bid Response",
    subtitle: "Response to MRH-RFP-2026-014",
    kind: "bid",
    vendor: "ScribeAI Health",
    summary:
      "Established premium vendor. Deep Epic and Cerner integrations, full multi-language support, complete compliance posture. Premium pricing at $85/provider/month and contractual terms that diverge from MRH's stated requirements on auto-renewal and price escalation.",
    pageCount: 7,
    sizeKb: 15,
    date: "2026-03-31",
  },
  {
    id: "clinicalnote-bid",
    filename: "clinicalnote-bid.pdf",
    title: "ClinicalNote.ai — Bid Response",
    subtitle: "Response to MRH-RFP-2026-014",
    kind: "bid",
    vendor: "ClinicalNote.ai",
    summary:
      "Younger AI-native vendor. Aggressive pricing at $45/provider/month and rapid iteration cadence. SOC 2 still in progress, Spanish support and Cerner integration on roadmap. Continuous-improvement program uses customer data on an opt-out basis.",
    pageCount: 6,
    sizeKb: 12,
    date: "2026-04-04",
  },
  {
    id: "documind-bid",
    filename: "documind-bid.pdf",
    title: "DocuMind Health — Bid Response",
    subtitle: "Response to MRH-RFP-2026-014",
    kind: "bid",
    vendor: "DocuMind Health",
    summary:
      "Specialty-focused vendor with strong depth across oncology, cardiology, and behavioral health. Mid-tier pricing at $65/provider/month. Strong compliance posture, but intellectual property and audio retention terms diverge from MRH's stated ownership and export requirements.",
    pageCount: 7,
    sizeKb: 14,
    date: "2026-04-02",
  },
];

export function getDocument(id: string): DemoDocument | undefined {
  return DEMO_DOCUMENTS.find((d) => d.id === id);
}

export function getRfp(): DemoDocument {
  const rfp = DEMO_DOCUMENTS.find((d) => d.kind === "rfp");
  if (!rfp) throw new Error("No RFP document configured.");
  return rfp;
}

export function getBids(): DemoDocument[] {
  return DEMO_DOCUMENTS.filter((d) => d.kind === "bid");
}
