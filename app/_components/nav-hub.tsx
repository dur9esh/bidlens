import Link from "next/link";
import {
  FileSignature,
  FileText,
  Gauge,
  History,
  ScanLine,
  Scale,
  ShieldAlert,
  Sliders,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type IconTint = "indigo" | "amber" | "emerald" | "slate";

interface SurfaceCard {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tint: IconTint;
}

interface SurfaceGroup {
  label: string;
  cards: SurfaceCard[];
}

const GROUPS: SurfaceGroup[] = [
  {
    label: "Inputs",
    cards: [
      {
        href: "/documents",
        title: "Documents",
        description:
          "The RFP and three vendor bids — the source of truth every BidLens claim traces back to.",
        icon: FileText,
        tint: "indigo",
      },
      {
        href: "/rubric",
        title: "Rubric",
        description:
          "Configurable weights, criteria, and pass/fail gates that govern every evaluation.",
        icon: Sliders,
        tint: "indigo",
      },
    ],
  },
  {
    label: "Evaluation",
    cards: [
      {
        href: "/ingestions",
        title: "Ingestions",
        description:
          "Structured extraction from PDFs — every field cited back to source text.",
        icon: ScanLine,
        tint: "amber",
      },
      {
        href: "/evaluations",
        title: "Evaluations",
        description:
          "Three specialized agents score each vendor against the rubric, with rationales and citations.",
        icon: Gauge,
        tint: "amber",
      },
      {
        href: "/compare",
        title: "Comparison",
        description:
          "Cross-vendor synthesis: side-by-side scorecards, common gaps, and clarification questions.",
        icon: Scale,
        tint: "amber",
      },
    ],
  },
  {
    label: "Artifacts",
    cards: [
      {
        href: "/memo",
        title: "Memo",
        description:
          "The formal recommendation document — written, signable, designed for the archive.",
        icon: FileSignature,
        tint: "emerald",
      },
      {
        href: "/risk-register",
        title: "Risk register",
        description:
          "Structured risks with severity, likelihood, citations, and recommended mitigations.",
        icon: ShieldAlert,
        tint: "emerald",
      },
    ],
  },
  {
    label: "Observability",
    cards: [
      {
        href: "/ask",
        title: "Ask the agent",
        description:
          "Open-ended Q&A grounded in the full evaluation corpus.",
        icon: Sparkles,
        tint: "slate",
      },
      {
        href: "/audit",
        title: "Audit trail",
        description:
          "Every agent action, model used, and citation — chronological and exportable.",
        icon: History,
        tint: "slate",
      },
    ],
  },
];

const TINT_CLASSES: Record<IconTint, { bg: string; fg: string }> = {
  indigo: { bg: "bg-indigo-50", fg: "text-indigo-600" },
  amber: { bg: "bg-amber-50", fg: "text-amber-700" },
  emerald: { bg: "bg-emerald-50", fg: "text-emerald-700" },
  slate: { bg: "bg-slate-100", fg: "text-slate-700" },
};

export function NavHub() {
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-24">
      <div className="font-sans text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase mb-2">
        Explore BidLens
      </div>
      <h2 className="font-serif text-3xl lg:text-4xl text-slate-900 mb-12 tracking-tight">
        Nine surfaces. One evaluation.
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-4">
            <div className="font-sans text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
              {group.label}
            </div>
            <div className="flex flex-col gap-3">
              {group.cards.map((card) => (
                <SurfaceCardLink key={card.href} card={card} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SurfaceCardLink({ card }: { card: SurfaceCard }) {
  const Icon = card.icon;
  const tint = TINT_CLASSES[card.tint];
  return (
    <Link
      href={card.href}
      className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-indigo-300 hover:shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint.bg}`}
        >
          <Icon className={`h-5 w-5 ${tint.fg}`} />
        </div>
        <h3 className="font-sans font-semibold text-slate-900">
          {card.title}
        </h3>
      </div>
      <p className="mt-4 text-sm text-slate-600 leading-relaxed">
        {card.description}
      </p>
      <div className="mt-4 text-xs font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100">
        Open →
      </div>
    </Link>
  );
}
