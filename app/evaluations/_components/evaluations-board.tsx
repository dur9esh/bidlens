"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flag,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DemoDocument } from "@/lib/documents";
import type {
  EvaluationCategory,
  EvaluationRecord,
} from "@/lib/evaluation/dao";
import type {
  CategoryEvaluationResult,
  EvaluationFlag,
  HardRequirementCheck,
} from "@/lib/evaluation/types";
import type { IngestionRecord } from "@/lib/ingestion/dao";
import type { Citation } from "@/lib/ingestion/types";

const CATEGORIES: {
  id: EvaluationCategory;
  label: string;
  available: boolean;
  comingIn?: string;
}[] = [
  { id: "technical", label: "Technical", available: true },
  { id: "commercial", label: "Commercial", available: false, comingIn: "PR 6" },
  { id: "compliance", label: "Compliance", available: false, comingIn: "PR 7" },
];

type EvalKey = `${string}:${EvaluationCategory}`;
type Status = EvaluationRecord["status"] | "absent";

function keyFor(vendorId: string, category: EvaluationCategory): EvalKey {
  return `${vendorId}:${category}`;
}

export function EvaluationsBoard({
  bids,
  initialEvaluations,
  ingestions,
}: {
  bids: DemoDocument[];
  initialEvaluations: EvaluationRecord[];
  ingestions: IngestionRecord[];
}) {
  const initialMap = useMemo(() => {
    const m: Record<EvalKey, EvaluationRecord> = {};
    for (const e of initialEvaluations) {
      m[keyFor(e.vendorId, e.category)] = e;
    }
    return m;
  }, [initialEvaluations]);

  const [records, setRecords] =
    useState<Record<EvalKey, EvaluationRecord>>(initialMap);
  const [running, setRunning] = useState<Record<EvalKey, boolean>>({});

  // Prerequisite check — does the RFP and every bid have a complete ingestion?
  const missingIngestions = useMemo(() => {
    const complete = new Set(
      ingestions
        .filter((i) => i.status === "complete")
        .map((i) => i.documentId)
    );
    const missing: string[] = [];
    if (!complete.has("rfp")) missing.push("RFP");
    for (const bid of bids) {
      if (!complete.has(bid.id)) missing.push(bid.vendor ?? bid.title);
    }
    return missing;
  }, [bids, ingestions]);

  async function runEvaluation(
    vendor: DemoDocument,
    category: EvaluationCategory
  ) {
    if (!CATEGORIES.find((c) => c.id === category)?.available) return;
    const k = keyFor(vendor.id, category);
    if (running[k]) return;

    setRunning((r) => ({ ...r, [k]: true }));
    setRecords((prev) => ({
      ...prev,
      [k]: {
        ...(prev[k] ?? {
          id: `local-${vendor.id}-${category}`,
          vendorId: vendor.id,
          category,
          model: null,
          inputTokens: null,
          outputTokens: null,
          latencyMs: null,
          result: null,
          updatedAt: new Date().toISOString(),
        }),
        status: "running",
        error: null,
      },
    }));

    try {
      const res = await fetch(
        `/api/evaluations/${vendor.id}/${category}`,
        { method: "POST" }
      );
      const body = (await res.json()) as
        | EvaluationRecord
        | { error: string };

      if (!res.ok) {
        if ("status" in body) {
          setRecords((prev) => ({ ...prev, [k]: body }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        throw new Error(
          ("error" in body && body.error) || `HTTP ${res.status}`
        );
      }
      if (!("status" in body)) {
        throw new Error("Unexpected response shape");
      }

      setRecords((prev) => ({ ...prev, [k]: body }));

      if (body.status === "complete" && body.result) {
        toast.success(
          `${body.result.vendor_name} scored: ${body.result.weighted_category_score.toFixed(1)} / 10 ${category}`
        );
      } else if (body.status === "error") {
        toast.error(body.error ?? "Evaluation failed");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Evaluation failed";
      toast.error(message);
      setRecords((prev) => ({
        ...prev,
        [k]: {
          ...(prev[k] ?? {
            id: `local-${vendor.id}-${category}`,
            vendorId: vendor.id,
            category,
            model: null,
            inputTokens: null,
            outputTokens: null,
            latencyMs: null,
            result: null,
            updatedAt: new Date().toISOString(),
          }),
          status: "error",
          error: message,
        },
      }));
    } finally {
      setRunning((r) => ({ ...r, [k]: false }));
    }
  }

  const allTechnicalComplete = bids.every(
    (b) => records[keyFor(b.id, "technical")]?.status === "complete"
  );

  return (
    <div className="flex-1">
      <main className="max-w-5xl mx-auto px-6 py-16 space-y-10">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="size-4" />
            BidLens
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Evaluations
          </h1>
          <p className="text-slate-600 max-w-2xl">
            BidLens scores each vendor against the rubric, one category at a
            time. Each category is a specialized agent. PR 5 ships the
            Technical Evaluator; Commercial and Compliance follow.
          </p>
        </div>

        {missingIngestions.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">
                {missingIngestions.length === 1
                  ? `${missingIngestions[0]} hasn't been ingested yet.`
                  : `${missingIngestions.length} documents haven't been ingested yet.`}
              </p>
              <p className="text-amber-800">
                Visit{" "}
                <Link
                  href="/ingestions"
                  className="font-medium underline-offset-2 hover:underline"
                >
                  Ingestions
                </Link>{" "}
                first — the evaluator needs the RFP and the bid as structured
                input.
              </p>
            </div>
          </div>
        )}

        {allTechnicalComplete && bids.length > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
            All vendors scored on Technical. Commercial evaluation arrives in
            PR 6.
          </div>
        )}

        <div className="space-y-6">
          {bids.map((bid) => (
            <VendorCard
              key={bid.id}
              vendor={bid}
              records={records}
              running={running}
              onRun={(cat) => runEvaluation(bid, cat)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function VendorCard({
  vendor,
  records,
  running,
  onRun,
}: {
  vendor: DemoDocument;
  records: Record<EvalKey, EvaluationRecord>;
  running: Record<EvalKey, boolean>;
  onRun: (category: EvaluationCategory) => void;
}) {
  return (
    <Card className="shadow-sm border-slate-200/80">
      <CardHeader>
        <CardTitle className="text-slate-900 text-xl">
          {vendor.vendor ?? vendor.title}
        </CardTitle>
        <p className="text-xs text-slate-500">{vendor.subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {CATEGORIES.map((cat, idx) => (
          <div key={cat.id}>
            {idx > 0 && <Separator className="my-4" />}
            <CategorySection
              vendor={vendor}
              category={cat}
              record={records[keyFor(vendor.id, cat.id)]}
              isRunning={!!running[keyFor(vendor.id, cat.id)]}
              onRun={() => onRun(cat.id)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CategorySection({
  vendor,
  category,
  record,
  isRunning,
  onRun,
}: {
  vendor: DemoDocument;
  category: { id: EvaluationCategory; label: string; available: boolean; comingIn?: string };
  record: EvaluationRecord | undefined;
  isRunning: boolean;
  onRun: () => void;
}) {
  const [open, setOpen] = useState(false);
  const status: Status = record?.status ?? "absent";

  if (!category.available) {
    return (
      <div className="flex items-center justify-between gap-4 opacity-60">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-500">{category.label}</p>
          <p className="text-xs text-slate-400">
            Coming in {category.comingIn}
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
          Not available
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900">{category.label}</p>
          {record?.status === "complete" && record.result ? (
            <div className="mt-1 flex items-baseline gap-3">
              <ScoreBadge score={record.result.weighted_category_score} />
              <span className="text-xs text-slate-500">
                {record.inputTokens?.toLocaleString() ?? "?"} input ·{" "}
                {record.outputTokens?.toLocaleString() ?? "?"} output ·{" "}
                {record.latencyMs
                  ? `${(record.latencyMs / 1000).toFixed(1)}s`
                  : "?s"}{" "}
                · <span className="font-mono">{record.model}</span>
              </span>
            </div>
          ) : record?.status === "error" && record.error ? (
            <p className="mt-1 text-xs text-rose-700 line-clamp-3">
              {record.error}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">
              Run the technical agent to score this vendor against the rubric.
            </p>
          )}
        </div>
        <StatusPill status={status} />
        <ActionButton
          status={status}
          isRunning={isRunning}
          onClick={onRun}
        />
      </div>

      {record?.status === "complete" && record.result && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              {open ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              {open
                ? "Hide technical scorecard"
                : "View technical scorecard"}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Scorecard
              vendorName={vendor.vendor ?? vendor.title}
              result={record.result}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function Scorecard({
  vendorName,
  result,
}: {
  vendorName: string;
  result: CategoryEvaluationResult;
}) {
  const anyHardFail = result.hard_requirement_checks.some(
    (h) => h.outcome === "fail"
  );

  return (
    <div className="mt-3 space-y-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      {anyHardFail && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          {vendorName} fails a technical hard requirement.
        </div>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Hard requirement checks
        </h3>
        <div className="space-y-2">
          {result.hard_requirement_checks.map((hr) => (
            <HardRequirementRow key={hr.requirement_id} check={hr} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Criterion scores
        </h3>
        <div className="space-y-3">
          {result.criterion_scores.map((cs) => (
            <div
              key={cs.criterion_id}
              className="rounded-md bg-white border border-slate-200 px-3 py-2.5 space-y-1.5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium text-sm text-slate-900">
                  {cs.criterion_name}
                </p>
                <ScoreBadge score={cs.score} small />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {cs.rationale}
              </p>
              {cs.citations.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {cs.citations.map((cit, i) => (
                    <CitationChip key={i} citation={cit} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {result.flags.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Flags
          </h3>
          <div className="space-y-2">
            {result.flags.map((flag, i) => (
              <FlagRow key={i} flag={flag} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-md bg-white border border-slate-200 px-3 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
          Category summary
        </h3>
        <p className="text-sm text-slate-800 leading-relaxed">
          {result.category_summary}
        </p>
      </section>
    </div>
  );
}

function HardRequirementRow({ check }: { check: HardRequirementCheck }) {
  const icon =
    check.outcome === "pass" ? (
      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
    ) : check.outcome === "fail" ? (
      <XCircle className="size-4 text-rose-600 shrink-0" />
    ) : (
      <AlertCircle className="size-4 text-amber-600 shrink-0" />
    );
  const badgeClass =
    check.outcome === "pass"
      ? "bg-emerald-100 text-emerald-800"
      : check.outcome === "fail"
        ? "bg-rose-100 text-rose-800"
        : "bg-amber-100 text-amber-800";

  return (
    <div className="rounded-md bg-white border border-slate-200 px-3 py-2 space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-medium text-sm text-slate-900 flex-1 min-w-0">
          {check.requirement_name}
        </p>
        <span
          className={cn(
            "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
            badgeClass
          )}
        >
          {check.outcome}
        </span>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed pl-6">
        {check.rationale}
      </p>
      {check.citation && (
        <div className="pl-6">
          <CitationChip citation={check.citation} />
        </div>
      )}
    </div>
  );
}

function FlagRow({ flag }: { flag: EvaluationFlag }) {
  const dotClass =
    flag.severity === "high"
      ? "bg-rose-500"
      : flag.severity === "medium"
        ? "bg-amber-500"
        : "bg-slate-400";
  return (
    <div className="rounded-md bg-white border border-slate-200 px-3 py-2 flex items-start gap-2">
      <span
        className={cn("size-2 mt-1.5 rounded-full shrink-0", dotClass)}
        aria-label={`severity ${flag.severity}`}
      />
      <Flag className="size-3.5 mt-0.5 text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 leading-snug">{flag.summary}</p>
        {flag.citation && (
          <div className="mt-1">
            <CitationChip citation={flag.citation} />
          </div>
        )}
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

function ScoreBadge({
  score,
  small = false,
}: {
  score: number;
  small?: boolean;
}) {
  const cls =
    score >= 7
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : score >= 4
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-rose-100 text-rose-800 border-rose-200";
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 rounded-md border px-2 py-0.5 font-mono tabular-nums",
        small ? "text-xs" : "text-base font-semibold",
        cls
      )}
    >
      {score.toFixed(1)}
      <span className={cn("opacity-60", small ? "text-[10px]" : "text-xs")}>
        / 10
      </span>
    </span>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status === "absent") {
    return (
      <span className="shrink-0 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
        Not evaluated
      </span>
    );
  }
  if (status === "running" || status === "pending") {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 animate-pulse">
        <Loader2 className="size-3 animate-spin" />
        Running
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        <CheckCircle2 className="size-3" />
        Complete
      </span>
    );
  }
  return (
    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800">
      <AlertCircle className="size-3" />
      Error
    </span>
  );
}

function ActionButton({
  status,
  isRunning,
  onClick,
}: {
  status: Status;
  isRunning: boolean;
  onClick: () => void;
}) {
  const disabled = isRunning || status === "running" || status === "pending";
  const isReeval = status === "complete" || status === "error";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium shadow-sm transition-colors",
        disabled
          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
          : "bg-indigo-600 text-white hover:bg-indigo-700"
      )}
    >
      {disabled ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          Running…
        </>
      ) : isReeval ? (
        <>
          <RefreshCw className="size-3.5" />
          Re-evaluate
        </>
      ) : (
        <>
          <Play className="size-3.5" />
          Evaluate
        </>
      )}
    </button>
  );
}
