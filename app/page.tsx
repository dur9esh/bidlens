"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Circle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type HealthOk = {
  status: "ok";
  model: string;
  modelResponse: string;
  latencyMs: number;
  timestamp: string;
};

type HealthError = {
  status: "error";
  error: string;
  timestamp: string;
};

type HealthResponse = HealthOk | HealthError;

type RoadmapItem = {
  pr: number;
  title: string;
  description: string;
  done: boolean;
};

const ROADMAP: RoadmapItem[] = [
  {
    pr: 1,
    title: "Scaffold",
    description: "Next.js, Gemini SDK, health check",
    done: true,
  },
  {
    pr: 2,
    title: "Demo data + viewer",
    description: "RFP + 3 vendor bid PDFs",
    done: true,
  },
  {
    pr: 3,
    title: "Rubric configurator",
    description: "Categories, weights, hard requirements",
    done: true,
  },
  {
    pr: 4,
    title: "Ingestion agents",
    description: "RFP and bid parsing to structured JSON",
    done: true,
  },
  {
    pr: 5,
    title: "Technical Evaluator",
    description: "Per-vendor technical scoring with citations",
    done: false,
  },
  {
    pr: 6,
    title: "Commercial Evaluator",
    description: "TCO normalization + commercial scoring",
    done: false,
  },
  {
    pr: 7,
    title: "Compliance Evaluator",
    description: "Certification + BAA verification",
    done: false,
  },
  {
    pr: 8,
    title: "Comparative dashboard",
    description: "Cross-vendor synthesis",
    done: false,
  },
  {
    pr: 9,
    title: "Risk register + Evaluation memo",
    description: "Opus-driven synthesis",
    done: false,
  },
  {
    pr: 10,
    title: "Ask the agent + Audit trail",
    description: "Q&A and defensibility",
    done: false,
  },
];

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = (await res.json()) as HealthResponse;
        if (!cancelled) setHealth(data);
      } catch (err) {
        if (!cancelled) {
          setHealth({
            status: "error",
            error: err instanceof Error ? err.message : "network error",
            timestamp: new Date().toISOString(),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1">
      <header className="border-b border-slate-200/70 bg-white/60 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-semibold tracking-tight text-indigo-600">
              BidLens
            </span>
            <span className="text-sm text-slate-500">
              Agentic AI bid evaluation
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-16">
        <section className="space-y-5">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-indigo-600">
            BidLens
          </h1>
          <p className="text-lg text-slate-700">
            Agentic AI bid evaluation for enterprise procurement teams.
          </p>
          <p className="text-slate-600 leading-relaxed max-w-2xl">
            BidLens ingests an RFP and multiple vendor bid documents, runs
            specialized AI evaluators in parallel per vendor, and surfaces
            risks, gaps, and trade-offs with citations back to bid text. The
            output is a defensible scorecard, evaluation memo, and risk
            register — with full audit trail.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
            System status
          </h2>
          <Card className="shadow-sm border-slate-200/80">
            <CardHeader>
              <div className="flex items-center gap-3">
                <StatusDot
                  loading={loading}
                  status={health?.status ?? null}
                />
                <CardTitle className="text-slate-900">
                  {loading
                    ? "Checking Gemini integration…"
                    : health?.status === "ok"
                      ? "Gemini integration live"
                      : "Gemini integration error"}
                </CardTitle>
              </div>
              <CardDescription className="pl-6">
                Calls <code className="font-mono">/api/health</code> on page
                load. The endpoint hits Gemini with a trivial prompt and
                returns the response.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : health?.status === "ok" ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <Field label="Model" value={health.model} mono />
                  <Field
                    label="Latency"
                    value={`${health.latencyMs} ms`}
                  />
                  <Field
                    label="Gemini response"
                    value={health.modelResponse}
                    mono
                    fullWidth
                  />
                  <Field
                    label="Timestamp"
                    value={health.timestamp}
                    fullWidth
                  />
                </dl>
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-rose-700">
                    {health?.error ?? "Unknown error"}
                  </p>
                  <p className="text-slate-600">
                    Add <code className="font-mono">GEMINI_API_KEY</code>{" "}
                    to <code className="font-mono">.env.local</code> for
                    local dev, or to Vercel project Environment Variables for
                    production.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/documents"
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              View documents
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/rubric"
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              Configure rubric
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/ingestions"
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              Run ingestion
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
            Build progress
          </h2>
          <ol className="space-y-2">
            {ROADMAP.map((item) => (
              <li
                key={item.pr}
                className="flex items-start gap-4 py-3 px-4 rounded-lg bg-white shadow-sm border border-slate-200/70"
              >
                {item.done ? (
                  <Check
                    className="size-5 mt-0.5 text-emerald-500 shrink-0"
                    aria-label="Complete"
                  />
                ) : (
                  <Circle
                    className="size-5 mt-0.5 text-slate-300 shrink-0"
                    aria-label="Upcoming"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-mono text-slate-400">
                      PR {item.pr}
                    </span>
                    <span
                      className={
                        item.done
                          ? "font-medium text-slate-900"
                          : "font-medium text-slate-500"
                      }
                    >
                      {item.title}
                    </span>
                  </div>
                  <p
                    className={
                      item.done
                        ? "text-sm text-slate-600"
                        : "text-sm text-slate-400"
                    }
                  >
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 mt-8">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <p className="text-xs text-slate-500">
            BidLens v0.1 · Prototype for Accellor Senior AI PM evaluation
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatusDot({
  loading,
  status,
}: {
  loading: boolean;
  status: "ok" | "error" | null;
}) {
  if (loading) {
    return (
      <span
        className="inline-block size-3 rounded-full bg-slate-300 animate-pulse"
        aria-label="Checking"
      />
    );
  }
  if (status === "ok") {
    return (
      <span
        className="inline-block size-3 rounded-full bg-emerald-500"
        aria-label="OK"
      />
    );
  }
  return (
    <span
      className="inline-block size-3 rounded-full bg-rose-500"
      aria-label="Error"
    />
  );
}

function Field({
  label,
  value,
  mono = false,
  fullWidth = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "font-mono text-slate-900 break-all"
            : "text-slate-900 break-all"
        }
      >
        {value}
      </dd>
    </div>
  );
}
