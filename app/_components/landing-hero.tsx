import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Contained gradient mesh + grain — decorative only */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute top-1/3 left-1/3 h-72 w-72 rounded-full bg-amber-100/50 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[22rem] w-[22rem] rounded-full bg-indigo-100/30 blur-3xl" />
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.04] mix-blend-multiply"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="hero-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#hero-noise)" />
        </svg>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pt-20 pb-24 lg:pt-32 lg:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left column — headline + sub + CTAs */}
          <div className="lg:col-span-7">
            <div
              className="hero-rise"
              style={{ animationDelay: "0ms" }}
            >
              <span className="inline-block font-sans text-xs font-semibold tracking-[0.18em] text-indigo-700 uppercase">
                Agentic AI · Procurement Evaluation
              </span>
            </div>

            <h1
              className="font-serif text-5xl lg:text-7xl leading-[1.05] tracking-tight text-slate-900 mt-6 hero-rise"
              style={{ animationDelay: "80ms" }}
            >
              Evaluate vendor bids.
              <br />
              <span className="italic">With citations,</span>
              <br />
              <span className="italic text-indigo-700">not vibes.</span>
            </h1>

            <p
              className="font-sans text-lg lg:text-xl text-slate-600 mt-8 max-w-xl leading-relaxed hero-rise"
              style={{ animationDelay: "160ms" }}
            >
              BidLens reads RFPs and vendor bids, scores them against a
              configurable rubric, and produces defensible recommendations —
              every claim is traceable to a specific line of bid text.
            </p>

            <div
              className="mt-10 flex flex-wrap gap-4 hero-rise"
              style={{ animationDelay: "240ms" }}
            >
              <Link
                href="/compare"
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 transition-colors"
              >
                See the comparison
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/documents"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 font-medium px-6 py-3 transition-colors"
              >
                Explore the scenario
              </Link>
            </div>

            <div
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 hero-rise"
              style={{ animationDelay: "320ms" }}
            >
              <span>Healthcare procurement</span>
              <span aria-hidden className="text-slate-300">
                ·
              </span>
              <span>HIPAA-aware</span>
              <span aria-hidden className="text-slate-300">
                ·
              </span>
              <span>Citation-grounded</span>
              <span aria-hidden className="text-slate-300">
                ·
              </span>
              <span>Audit-ready</span>
            </div>
          </div>

          {/* Right column — typographic stat flourish */}
          <div className="lg:col-span-5 lg:pt-8">
            <div className="flex flex-col gap-10">
              <StatBlock
                number="3"
                label="vendors evaluated"
                detail="ScribeAI Health · ClinicalNote.ai · DocuMind Health"
                accent="indigo"
                delay={360}
              />
              <StatBlock
                number="14"
                label="criteria scored"
                detail="Across technical, commercial, and compliance categories"
                accent="amber"
                delay={440}
              />
              <StatBlock
                number="9"
                label="synthesis surfaces"
                detail="Plus a rubric-bounded evaluation memo and structured risk register"
                accent="slate"
                delay={520}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatBlock({
  number,
  label,
  detail,
  accent,
  delay,
}: {
  number: string;
  label: string;
  detail: string;
  accent: "indigo" | "amber" | "slate";
  delay: number;
}) {
  const borderClass =
    accent === "indigo"
      ? "border-indigo-600"
      : accent === "amber"
        ? "border-amber-500"
        : "border-slate-400";
  const numberClass =
    accent === "indigo"
      ? "text-slate-900"
      : accent === "amber"
        ? "text-amber-700"
        : "text-slate-900";

  return (
    <div
      className={`border-l-2 ${borderClass} pl-6 hero-rise`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`font-serif text-6xl lg:text-7xl leading-none tabular-nums ${numberClass}`}
      >
        {number}
      </div>
      <div className="font-sans text-xs font-semibold text-slate-500 mt-3 uppercase tracking-[0.18em]">
        {label}
      </div>
      <div className="font-sans text-sm text-slate-600 mt-1.5 leading-relaxed">
        {detail}
      </div>
    </div>
  );
}
