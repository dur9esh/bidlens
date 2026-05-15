"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  CheckCircle2,
  Copy,
  Crosshair,
  Flag,
  Loader2,
  Play,
  RefreshCw,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DemoDocument } from "@/lib/documents";
import type { EvaluationRecord } from "@/lib/evaluation/dao";
import type { Citation } from "@/lib/ingestion/types";
import type { Rubric } from "@/lib/rubric/types";
import type { SynthesisRecord } from "@/lib/synthesis/dao";
import type {
  ClarificationQuestion,
  ComparativeSynthesisResult,
  CriterionComparison,
  Insight,
  VendorScoreEntry,
  VendorScoreSummary,
} from "@/lib/synthesis/types";

type InsightTab =
  | "common_gap"
  | "standout_strength"
  | "standout_weakness"
  | "cross_vendor_risk";

const INSIGHT_TABS: { id: InsightTab; label: string; icon: typeof Crosshair }[] =
  [
    { id: "common_gap", label: "Common gaps", icon: Crosshair },
    { id: "standout_strength", label: "Standout strengths", icon: Star },
    { id: "standout_weakness", label: "Standout weaknesses", icon: AlertTriangle },
    { id: "cross_vendor_risk", label: "Cross-vendor risks", icon: Flag },
  ];

const CATEGORY_COLORS: Record<CriterionComparison["category"], string> = {
  technical: "bg-indigo-50 text-indigo-700 border-indigo-200",
  commercial: "bg-amber-50 text-amber-800 border-amber-200",
  compliance: "bg-slate-100 text-slate-700 border-slate-300",
};

export function ComparativeDashboard({
  bids,
  evaluations,
  rubric,
  initialSynthesis,
}: {
  bids: DemoDocument[];
  evaluations: EvaluationRecord[];
  rubric: Rubric;
  initialSynthesis: SynthesisRecord | null;
}) {
  const [synthesis, setSynthesis] = useState<SynthesisRecord | null>(
    initialSynthesis
  );
  const [running, setRunning] = useState(false);

  // Prerequisite check: all 9 evaluations must be complete
  const missingEvaluations = useMemo(() => {
    const missing: string[] = [];
    for (const bid of bids) {
      for (const cat of ["technical", "commercial", "compliance"] as const) {
        const ev = evaluations.find(
          (e) =>
            e.vendorId === bid.id &&
            e.category === cat &&
            e.status === "complete"
        );
        if (!ev) missing.push(`${bid.vendor ?? bid.title} · ${cat}`);
      }
    }
    return missing;
  }, [bids, evaluations]);

  async function runSynthesis() {
    if (running) return;
    setRunning(true);
    // Optimistic running placeholder
    setSynthesis((prev) => ({
      id: prev?.id ?? "local-comparative",
      kind: "comparative",
      status: "running",
      model: prev?.model ?? null,
      inputTokens: prev?.inputTokens ?? null,
      outputTokens: prev?.outputTokens ?? null,
      latencyMs: prev?.latencyMs ?? null,
      result: prev?.result ?? null,
      error: null,
      updatedAt: new Date().toISOString(),
    }));

    try {
      const res = await fetch("/api/synthesis/comparative", {
        method: "POST",
      });
      const body = (await res.json()) as
        | SynthesisRecord
        | { error: string };

      if (!res.ok) {
        if ("status" in body) {
          setSynthesis(body);
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        throw new Error(
          ("error" in body && body.error) || `HTTP ${res.status}`
        );
      }
      if (!("status" in body)) {
        throw new Error("Unexpected response shape");
      }
      setSynthesis(body);
      if (body.status === "complete") {
        toast.success(
          `Comparative synthesis complete (${body.latencyMs ? (body.latencyMs / 1000).toFixed(1) : "?"}s)`
        );
      } else if (body.status === "error") {
        toast.error(body.error ?? "Synthesis failed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Synthesis failed";
      toast.error(message);
      setSynthesis((prev) => ({
        ...(prev ?? {
          id: "local-comparative",
          kind: "comparative",
          model: null,
          inputTokens: null,
          outputTokens: null,
          latencyMs: null,
          result: null,
          updatedAt: new Date().toISOString(),
        }),
        status: "error",
        error: message,
      }));
    } finally {
      setRunning(false);
    }
  }

  const result =
    synthesis?.status === "complete" && synthesis.result
      ? (synthesis.result as ComparativeSynthesisResult)
      : null;
  const status = synthesis?.status ?? "absent";
  const hasPrereqs = missingEvaluations.length === 0;
  // void rubric to silence unused warning while still accepting it as a prop
  void rubric;

  return (
    <div className="flex-1">
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="size-4" />
            BidLens
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Comparative Analysis
          </h1>
          <p className="text-slate-600 max-w-3xl">
            Cross-vendor synthesis powered by the highest-reasoning model in
            the routing policy. The synthesis agent reads all 9 evaluations
            plus the underlying bid ingestions and surfaces patterns no single
            per-vendor evaluator could.
          </p>
        </div>

        {!hasPrereqs && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">
                Comparative synthesis needs all 9 evaluations complete (3
                vendors × 3 categories).
              </p>
              <p className="text-amber-800">
                Missing:{" "}
                {missingEvaluations.map((m, i) => (
                  <span key={m}>
                    <span className="font-mono">{m}</span>
                    {i < missingEvaluations.length - 1 ? ", " : ""}
                  </span>
                ))}
                . Visit{" "}
                <Link
                  href="/evaluations"
                  className="font-medium underline-offset-2 hover:underline"
                >
                  Evaluations
                </Link>{" "}
                first.
              </p>
            </div>
          </div>
        )}

        <ActionBar
          synthesis={synthesis}
          status={status}
          running={running}
          disabled={!hasPrereqs}
          onRun={runSynthesis}
        />

        {!result && hasPrereqs && (
          <Card className="shadow-sm border-slate-200/80">
            <CardContent className="py-12 text-center text-slate-500">
              Run the comparative synthesis to see the full cross-vendor
              analysis.
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <VendorScorecardSummary
              summaries={result.vendor_score_summaries}
              ranking={result.ranking}
            />
            <RankingCard
              ranking={result.ranking}
              rationale={result.ranking_rationale}
              summaries={result.vendor_score_summaries}
            />
            <CriterionComparisonTable
              comparisons={result.criterion_comparisons}
              vendors={result.vendor_score_summaries}
            />
            <InsightsPanel
              insights={result.insights}
              vendors={result.vendor_score_summaries}
            />
            <ClarificationsCard questions={result.clarification_questions} />
            <ExecutiveSummaryCard summary={result.executive_summary} />
          </>
        )}
      </main>
    </div>
  );
}

function ActionBar({
  synthesis,
  status,
  running,
  disabled,
  onRun,
}: {
  synthesis: SynthesisRecord | null;
  status: SynthesisRecord["status"] | "absent";
  running: boolean;
  disabled: boolean;
  onRun: () => void;
}) {
  const hasResult = synthesis?.status === "complete";

  return (
    <Card className="shadow-sm border-slate-200/80">
      <CardContent className="pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <StatusPill status={status} />
            {hasResult && synthesis ? (
              <span className="text-xs text-slate-500">
                {synthesis.inputTokens?.toLocaleString() ?? "?"} input ·{" "}
                {synthesis.outputTokens?.toLocaleString() ?? "?"} output ·{" "}
                {synthesis.latencyMs
                  ? `${(synthesis.latencyMs / 1000).toFixed(1)}s`
                  : "?s"}{" "}
                ·{" "}
                <span className="font-mono">{synthesis.model ?? "?"}</span>
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                ~30–90s. Uses the synthesis model chain (pro → flash → flash-lite).
              </span>
            )}
          </div>
          {synthesis?.status === "error" && synthesis.error && (
            <p className="text-xs text-rose-700 line-clamp-2">
              {synthesis.error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={disabled || running}
          className={cn(
            "shrink-0 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-colors",
            disabled || running
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          )}
        >
          {running ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Running…
            </>
          ) : hasResult ? (
            <>
              <RefreshCw className="size-4" />
              Re-run synthesis
            </>
          ) : (
            <>
              <Play className="size-4" />
              Run comparative synthesis
            </>
          )}
        </button>
      </CardContent>
    </Card>
  );
}

function VendorScorecardSummary({
  summaries,
  ranking,
}: {
  summaries: VendorScoreSummary[];
  ranking: string[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
        Scorecard
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaries.map((s) => {
          const rank = ranking.indexOf(s.vendor_id);
          const rankBadge = rank >= 0 ? `#${rank + 1}` : null;
          return (
            <Card
              key={s.vendor_id}
              className="shadow-sm border-slate-200/80 relative"
            >
              {rankBadge && (
                <span
                  className={cn(
                    "absolute top-3 right-3 inline-flex items-center justify-center size-7 rounded-full text-xs font-semibold text-white",
                    rank === 0
                      ? "bg-indigo-600"
                      : rank === 1
                        ? "bg-indigo-400"
                        : "bg-slate-400"
                  )}
                >
                  {rankBadge}
                </span>
              )}
              <CardHeader>
                <CardTitle className="text-slate-900 text-lg">
                  {s.vendor_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-xs uppercase tracking-wide text-slate-500">
                    Overall
                  </span>
                  <div className="mt-1">
                    {s.overall_weighted_score != null ? (
                      <BigScoreBadge score={s.overall_weighted_score} />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <SubScore label="Technical" score={s.technical_score} />
                  <SubScore label="Commercial" score={s.commercial_score} />
                  <SubScore label="Compliance" score={s.compliance_score} />
                </div>
                <HardRequirementChip
                  fails={s.failed_hard_requirements}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function SubScore({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono font-medium tabular-nums",
          scoreColorClass(score)
        )}
      >
        {score == null ? "—" : score.toFixed(1)}
      </div>
    </div>
  );
}

function HardRequirementChip({ fails }: { fails: string[] }) {
  if (fails.length === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
        title="All enabled hard requirements pass"
      >
        <CheckCircle2 className="size-3" />
        All hard reqs passed
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800 cursor-help"
      title={fails.join("\n")}
    >
      <AlertCircle className="size-3" />
      Fails {fails.length} hard req{fails.length === 1 ? "" : "s"}
    </span>
  );
}

function RankingCard({
  ranking,
  rationale,
  summaries,
}: {
  ranking: string[];
  rationale: string;
  summaries: VendorScoreSummary[];
}) {
  const byId = useMemo(() => {
    const m: Record<string, VendorScoreSummary> = {};
    for (const s of summaries) m[s.vendor_id] = s;
    return m;
  }, [summaries]);

  const topFails = ranking
    .slice(0, 1)
    .map((id) => byId[id])
    .filter((s) => s && s.failed_hard_requirements.length > 0);

  return (
    <Card className="shadow-sm border-slate-200/80">
      <CardHeader>
        <CardTitle className="text-slate-900 text-lg">
          Recommendation order
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-2">
          {ranking.map((vid, i) => {
            const s = byId[vid];
            return (
              <li key={vid} className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center justify-center size-6 rounded-full text-xs font-semibold text-white shrink-0",
                    i === 0
                      ? "bg-indigo-600"
                      : i === 1
                        ? "bg-indigo-400"
                        : "bg-slate-400"
                  )}
                >
                  {i + 1}
                </span>
                <span className="font-medium text-slate-900">
                  {s?.vendor_name ?? vid}
                </span>
                {s?.overall_weighted_score != null && (
                  <span className="text-xs text-slate-500 font-mono">
                    {s.overall_weighted_score.toFixed(1)} / 10
                  </span>
                )}
                {s && s.failed_hard_requirements.length > 0 && (
                  <span className="text-xs text-rose-700">
                    · fails {s.failed_hard_requirements.length} hard req
                    {s.failed_hard_requirements.length === 1 ? "" : "s"}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-slate-700 leading-relaxed">{rationale}</p>
        {topFails.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Note: ranking reflects scored fit;{" "}
            <span className="font-medium">{topFails[0].vendor_name}</span>{" "}
            fails {topFails[0].failed_hard_requirements.length} hard
            requirement
            {topFails[0].failed_hard_requirements.length === 1 ? "" : "s"} (
            {topFails[0].failed_hard_requirements.join(", ")}), which is a
            separate gate the procurement team must address before final
            selection.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type SortKey =
  | "criterion"
  | "category"
  | `vendor:${string}`;

function CriterionComparisonTable({
  comparisons,
  vendors,
}: {
  comparisons: CriterionComparison[];
  vendors: VendorScoreSummary[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("category");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function vendorScore(c: CriterionComparison, vendorId: string): number | null {
    const entry = c.scores_by_vendor.find(
      (e: VendorScoreEntry) => e.vendor_id === vendorId
    );
    return entry?.score ?? null;
  }

  const sorted = useMemo(() => {
    const out = [...comparisons];
    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      if (sortKey === "criterion")
        return a.criterion_name.localeCompare(b.criterion_name) * dir;
      if (sortKey === "category")
        return a.category.localeCompare(b.category) * dir;
      if (sortKey.startsWith("vendor:")) {
        const vid = sortKey.slice("vendor:".length);
        const av = vendorScore(a, vid);
        const bv = vendorScore(b, vid);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av - bv) * dir;
      }
      return 0;
    });
    return out;
  }, [comparisons, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key.startsWith("vendor:") ? "desc" : "asc");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
        Side-by-side criterion comparison
      </h2>
      <Card className="shadow-sm border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <SortHeader
                  label="Criterion"
                  active={sortKey === "criterion"}
                  dir={sortDir}
                  onClick={() => toggleSort("criterion")}
                />
                <SortHeader
                  label="Category"
                  active={sortKey === "category"}
                  dir={sortDir}
                  onClick={() => toggleSort("category")}
                />
                {vendors.map((v) => (
                  <SortHeader
                    key={v.vendor_id}
                    label={v.vendor_name}
                    active={sortKey === `vendor:${v.vendor_id}`}
                    dir={sortDir}
                    onClick={() => toggleSort(`vendor:${v.vendor_id}`)}
                    align="center"
                  />
                ))}
                <th className="text-left px-3 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr
                  key={c.criterion_id}
                  className={cn(
                    "border-t border-slate-100",
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                  )}
                >
                  <td className="px-3 py-2 font-medium text-slate-900 align-top">
                    {c.criterion_name}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={cn(
                        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize",
                        CATEGORY_COLORS[c.category]
                      )}
                    >
                      {c.category}
                    </span>
                  </td>
                  {vendors.map((v) => {
                    const score = vendorScore(c, v.vendor_id);
                    return (
                      <td
                        key={v.vendor_id}
                        className="px-3 py-2 align-top text-center"
                      >
                        {score == null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <CellScore score={score} />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 align-top text-xs text-slate-600 leading-relaxed max-w-md">
                    {c.comparative_note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "center";
}) {
  return (
    <th
      className={cn(
        "px-3 py-2 font-medium select-none",
        align === "center" ? "text-center" : "text-left"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-slate-900 transition-colors",
          active && "text-slate-900"
        )}
      >
        {label}
        <ArrowUpDown
          className={cn("size-3", active ? "opacity-100" : "opacity-30")}
        />
        {active && (
          <span className="text-[10px]">{dir === "asc" ? "↑" : "↓"}</span>
        )}
      </button>
    </th>
  );
}

function CellScore({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline rounded-md border px-1.5 py-0.5 text-xs font-mono font-medium tabular-nums",
        scoreBadgeClass(score)
      )}
    >
      {score.toFixed(1)}
    </span>
  );
}

function BigScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 rounded-md border px-2.5 py-1 font-mono tabular-nums text-2xl font-semibold",
        scoreBadgeClass(score)
      )}
    >
      {score.toFixed(1)}
      <span className="text-xs opacity-60">/ 10</span>
    </span>
  );
}

function InsightsPanel({
  insights,
  vendors,
}: {
  insights: Insight[];
  vendors: VendorScoreSummary[];
}) {
  const [active, setActive] = useState<InsightTab>("standout_strength");
  const filtered = insights.filter((i) => i.kind === active);
  const vendorNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const v of vendors) m[v.vendor_id] = v.vendor_name;
    return m;
  }, [vendors]);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
        Cross-vendor insights
      </h2>
      <Card className="shadow-sm border-slate-200/80">
        <CardContent className="pt-6 space-y-4">
          <div
            className="flex flex-wrap gap-2 border-b border-slate-200 -mx-6 px-6 pb-3"
            role="tablist"
          >
            {INSIGHT_TABS.map((tab) => {
              const Icon = tab.icon;
              const count = insights.filter((i) => i.kind === tab.id).length;
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      : "text-slate-600 hover:text-slate-900 border border-transparent"
                  )}
                >
                  <Icon className="size-4" />
                  {tab.label}
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-1.5 text-[10px]",
                      isActive
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              No {INSIGHT_TABS.find((t) => t.id === active)?.label.toLowerCase()}{" "}
              surfaced.
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((insight, i) => (
                <InsightRow
                  key={i}
                  insight={insight}
                  vendorNameById={vendorNameById}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function InsightRow({
  insight,
  vendorNameById,
}: {
  insight: Insight;
  vendorNameById: Record<string, string>;
}) {
  const dotClass =
    insight.severity === "high"
      ? "bg-rose-500"
      : insight.severity === "medium"
        ? "bg-amber-500"
        : insight.severity === "low"
          ? "bg-slate-400"
          : "bg-slate-300";

  return (
    <div className="rounded-md bg-white border border-slate-200 px-3 py-2.5 space-y-1.5">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-1.5 size-2 rounded-full shrink-0",
            dotClass
          )}
          aria-label={`severity ${insight.severity ?? "none"}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="font-medium text-sm text-slate-900">
              {insight.title}
            </p>
            {insight.vendor_ids.length > 0 &&
              insight.vendor_ids.map((vid) => (
                <span
                  key={vid}
                  className="inline-flex items-center rounded bg-indigo-50 border border-indigo-200 text-[10px] font-medium text-indigo-700 px-1.5 py-0.5"
                >
                  {vendorNameById[vid] ?? vid}
                </span>
              ))}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mt-1">
            {insight.detail}
          </p>
          {insight.citations.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {insight.citations.map((c, i) => (
                <CitationChip key={i} citation={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CitationChip({ citation }: { citation: Citation }) {
  return (
    <span
      title={citation.verbatim_excerpt}
      className="inline-flex items-center bg-slate-100 text-slate-600 text-xs rounded px-1.5 py-0.5 cursor-help"
    >
      p.{citation.page}
    </span>
  );
}

function ClarificationsCard({
  questions,
}: {
  questions: ClarificationQuestion[];
}) {
  const grouped = useMemo(() => {
    const map: Record<string, { name: string; items: ClarificationQuestion[] }> = {};
    for (const q of questions) {
      if (!map[q.vendor_id])
        map[q.vendor_id] = { name: q.vendor_name, items: [] };
      map[q.vendor_id].items.push(q);
    }
    return map;
  }, [questions]);

  if (questions.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
        Questions to send to vendors
      </h2>
      <Card className="shadow-sm border-slate-200/80">
        <CardContent className="pt-6 space-y-5">
          {Object.entries(grouped).map(([vid, group], idx) => (
            <div key={vid}>
              {idx > 0 && <Separator className="my-4" />}
              <p className="font-medium text-sm text-slate-900 mb-2">
                {group.name}
              </p>
              <ul className="space-y-3">
                {group.items.map((q, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CopyButton text={q.question} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 leading-relaxed">
                        {q.question}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 leading-snug">
                        Why: {q.reason}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Question copied");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Copy failed");
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "shrink-0 mt-0.5 inline-flex items-center justify-center size-6 rounded border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors",
        copied && "border-emerald-300 bg-emerald-50"
      )}
      aria-label="Copy question"
      title="Copy question"
    >
      {copied ? (
        <CheckCircle2 className="size-3.5 text-emerald-600" />
      ) : (
        <Copy className="size-3.5 text-slate-500" />
      )}
    </button>
  );
}

function ExecutiveSummaryCard({ summary }: { summary: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
        Executive summary
      </h2>
      <Card className="shadow-sm border-slate-200/80 border-l-4 border-l-indigo-600 bg-indigo-50/30">
        <CardContent className="pt-6">
          <p className="text-base text-slate-900 leading-relaxed">{summary}</p>
        </CardContent>
      </Card>
    </section>
  );
}

function StatusPill({
  status,
}: {
  status: SynthesisRecord["status"] | "absent";
}) {
  if (status === "absent") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
        Not run yet
      </span>
    );
  }
  if (status === "running" || status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 animate-pulse">
        <Loader2 className="size-3 animate-spin" />
        Running
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        <CheckCircle2 className="size-3" />
        Complete
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800">
      <AlertCircle className="size-3" />
      Error
    </span>
  );
}

function scoreColorClass(score: number | null): string {
  if (score == null) return "text-slate-400";
  if (score >= 7) return "text-emerald-700";
  if (score >= 4) return "text-amber-700";
  return "text-rose-700";
}

function scoreBadgeClass(score: number): string {
  if (score >= 7)
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (score >= 4) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}
