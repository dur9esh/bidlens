"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TaskType } from "@/lib/ai";
import {
  getChainFor,
  ROUTING_RATIONALE,
  TASK_TYPES_IN_ORDER,
} from "@/lib/ai-routing-policy";

type HealthOk = {
  status: "ok";
  model: string;
  modelResponse: string;
  fallbacksTriggered?: { model: string; reason: string }[];
  latencyMs: number;
  timestamp: string;
};

type HealthError = {
  status: "error";
  error: string;
  timestamp: string;
};

type HealthResponse = HealthOk | HealthError;

const BUILD_JOURNEY = `BidLens shipped in ten focused PRs across a handful of build sessions. We started with scaffold and document viewer, layered in rubric configuration, then the ingestion and per-vendor evaluation agents, then cross-vendor synthesis, then the deliverable artifacts, and finally Q&A and the audit trail. Real constraints surfaced along the way — a mid-build provider migration from Anthropic to Gemini, free-tier rate limits that drove a task-aware model routing policy, and an evaluator agent that needed schema-level bounding to stop inventing requirements — and each became a stronger architectural decision than if it had worked first try.`;

export function EngineeringNotes() {
  return (
    <section className="border-t border-slate-200 bg-white py-16">
      <div className="max-w-5xl mx-auto px-6 lg:px-12">
        <details className="group">
          <summary className="cursor-pointer flex items-center justify-between list-none">
            <div>
              <div className="font-sans text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                Under the hood
              </div>
              <h2 className="font-serif text-2xl lg:text-3xl text-slate-900 mt-1 tracking-tight">
                Engineering notes
              </h2>
            </div>
            <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>

          <div className="mt-10 space-y-14">
            <SystemStatus />
            <RoutingPolicy />
            <BuildJourney />
          </div>
        </details>
      </div>
    </section>
  );
}

function SystemStatus() {
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
    <div className="space-y-3">
      <div className="font-sans text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
        Live health check
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
        <div className="flex items-center gap-3">
          <StatusDot
            loading={loading}
            status={health?.status ?? null}
          />
          <p className="text-sm font-medium text-slate-900">
            {loading
              ? "Checking Gemini integration…"
              : health?.status === "ok"
                ? "Gemini integration live"
                : "Gemini integration error"}
          </p>
        </div>
        {!loading && health?.status === "ok" && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-xs">
            <StatField label="Model" value={health.model} mono />
            <StatField label="Latency" value={`${health.latencyMs} ms`} />
            <StatField
              label="Response"
              value={health.modelResponse}
              mono
            />
            <StatField label="Checked" value={health.timestamp.slice(11, 19) + "Z"} />
            {health.fallbacksTriggered &&
              health.fallbacksTriggered.length > 0 && (
                <div className="col-span-2 sm:col-span-4 text-xs text-amber-800">
                  Fallback active: primary unavailable, served by{" "}
                  <span className="font-mono">{health.model}</span>.
                </div>
              )}
          </div>
        )}
        {!loading && health?.status === "error" && (
          <p className="mt-3 text-sm text-rose-700">
            {health.error}
          </p>
        )}
      </div>
    </div>
  );
}

function StatField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={cn(
          "truncate text-slate-900",
          mono && "font-mono text-xs"
        )}
        title={value}
      >
        {value}
      </div>
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
        className="inline-block size-2.5 rounded-full bg-slate-300 animate-pulse"
        aria-label="Checking"
      />
    );
  }
  if (status === "ok") {
    return (
      <span
        className="inline-block size-2.5 rounded-full bg-emerald-500"
        aria-label="OK"
      />
    );
  }
  return (
    <span
      className="inline-block size-2.5 rounded-full bg-rose-500"
      aria-label="Error"
    />
  );
}

function RoutingPolicy() {
  return (
    <div className="space-y-3">
      <div className="font-sans text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
        Model routing policy
      </div>
      <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
        Every Gemini call routes through a per-task chain. Capability is
        matched to cognitive demand; ordering respects the free-tier quota
        budget. Each chain has full fallback coverage.
      </p>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Task</th>
              <th className="text-left px-4 py-2.5 font-medium">Chain</th>
              <th className="text-left px-4 py-2.5 font-medium">Why</th>
            </tr>
          </thead>
          <tbody>
            {TASK_TYPES_IN_ORDER.map((tt, i) => (
              <RoutingRow key={tt} taskType={tt} alt={i % 2 === 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoutingRow({
  taskType,
  alt,
}: {
  taskType: TaskType;
  alt: boolean;
}) {
  const rationale = ROUTING_RATIONALE[taskType];
  const chain = getChainFor(taskType);
  return (
    <tr
      className={cn("border-t border-slate-100", alt && "bg-slate-50/40")}
    >
      <td className="px-4 py-3 align-top">
        <div className="font-medium text-slate-900">{rationale.label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{rationale.volume}</div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {chain.map((m, i) => (
            <span key={m} className="inline-flex items-center gap-1.5">
              <span
                className={
                  i === 0
                    ? "font-mono font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5"
                    : "font-mono text-slate-500 bg-slate-100 rounded px-1.5 py-0.5"
                }
              >
                {m}
              </span>
              {i < chain.length - 1 && (
                <span className="text-slate-300" aria-hidden>
                  →
                </span>
              )}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 align-top text-xs text-slate-600 leading-relaxed max-w-md">
        {rationale.rationale}
      </td>
    </tr>
  );
}

function BuildJourney() {
  const prs = [
    "Scaffold",
    "Documents",
    "Rubric",
    "Ingestion",
    "Technical",
    "Commercial",
    "Compliance",
    "Comparison",
    "Memo · Risk",
    "Q&A · Audit",
  ];
  return (
    <div className="space-y-3">
      <div className="font-sans text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
        Build journey
      </div>
      <p className="text-sm text-slate-700 max-w-3xl leading-relaxed">
        {BUILD_JOURNEY}
      </p>
      <div className="mt-4 overflow-x-auto">
        <ol className="flex items-center gap-1 text-[11px] font-mono text-slate-600">
          {prs.map((label, i) => (
            <li key={label} className="flex items-center gap-1 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1">
                <span className="text-indigo-600 font-semibold">
                  PR{i + 1}
                </span>
                <span className="text-slate-700">{label}</span>
              </span>
              {i < prs.length - 1 && (
                <span className="text-slate-300" aria-hidden>
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
