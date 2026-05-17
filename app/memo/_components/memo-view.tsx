"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EvaluationRecord } from "@/lib/evaluation/dao";
import type { Citation } from "@/lib/ingestion/types";
import type { SynthesisRecord } from "@/lib/synthesis/dao";
import type {
  EvaluationMemo,
  MemoSection,
} from "@/lib/synthesis/memo-types";

export function MemoView({
  initialMemo,
  comparative,
  evaluations,
}: {
  initialMemo: SynthesisRecord | null;
  comparative: SynthesisRecord | null;
  evaluations: EvaluationRecord[];
}) {
  const [memo, setMemo] = useState<SynthesisRecord | null>(initialMemo);
  const [running, setRunning] = useState(false);

  const hasComparative = comparative?.status === "complete";
  const completeCount = evaluations.filter(
    (e) => e.status === "complete"
  ).length;
  const evaluationsReady = completeCount >= 9;
  const ready = hasComparative && evaluationsReady;

  async function runMemo() {
    if (running) return;
    setRunning(true);
    setMemo((prev) => ({
      id: prev?.id ?? "local-memo",
      kind: "memo",
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
      const res = await fetch("/api/synthesis/memo", { method: "POST" });
      const body = (await res.json()) as
        | SynthesisRecord
        | { error: string };
      if (!res.ok) {
        if ("status" in body) {
          setMemo(body);
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        throw new Error(
          ("error" in body && body.error) || `HTTP ${res.status}`
        );
      }
      if (!("status" in body))
        throw new Error("Unexpected response shape");
      setMemo(body);
      if (body.status === "complete") {
        toast.success(
          `Memo generated (${body.latencyMs ? (body.latencyMs / 1000).toFixed(1) : "?"}s)`
        );
      } else if (body.status === "error") {
        toast.error(body.error ?? "Memo generation failed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Memo generation failed";
      toast.error(message);
      setMemo((prev) => ({
        ...(prev ?? {
          id: "local-memo",
          kind: "memo",
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
    memo?.status === "complete" && memo.result
      ? (memo.result as EvaluationMemo)
      : null;

  return (
    <div className="flex-1">
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="size-4" />
            BidLens
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Evaluation Memo
          </h1>
          <p className="text-slate-600">
            The formal memo procurement leadership reads and signs. Generated
            by the synthesis agent from the complete evaluation record.
          </p>
        </div>

        {!ready && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="font-medium">
                Memo generation needs the upstream artifacts complete.
              </p>
              <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                {!evaluationsReady && (
                  <li>
                    {completeCount} of 9 evaluations complete —{" "}
                    <Link
                      href="/evaluations"
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      visit Evaluations
                    </Link>
                  </li>
                )}
                {!hasComparative && (
                  <li>
                    Comparative synthesis not yet complete —{" "}
                    <Link
                      href="/compare"
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      visit Compare
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        <ActionBar
          synthesis={memo}
          running={running}
          disabled={!ready}
          onRun={runMemo}
          hasResult={!!result}
          onDownload={() => result && downloadMarkdown(result)}
        />

        {!result && ready && (
          <Card className="shadow-sm border-slate-200/80">
            <CardContent className="py-12 text-center text-slate-500 space-y-2">
              <p>Generate the memo to see the formal evaluation document.</p>
              <p className="text-xs">
                Includes an executive summary, recommendation with caveats,
                per-vendor analysis, open questions, and a signatures block.
              </p>
            </CardContent>
          </Card>
        )}

        {result && <MemoDocument memo={result} />}
      </main>
    </div>
  );
}

function ActionBar({
  synthesis,
  running,
  disabled,
  onRun,
  hasResult,
  onDownload,
}: {
  synthesis: SynthesisRecord | null;
  running: boolean;
  disabled: boolean;
  onRun: () => void;
  hasResult: boolean;
  onDownload: () => void;
}) {
  const status = synthesis?.status ?? "absent";
  return (
    <Card className="shadow-sm border-slate-200/80">
      <CardContent className="pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <StatusPill status={status} />
            {synthesis?.status === "complete" && (
              <span className="text-xs text-slate-500">
                {synthesis.inputTokens?.toLocaleString() ?? "?"} input ·{" "}
                {synthesis.outputTokens?.toLocaleString() ?? "?"} output ·{" "}
                {synthesis.latencyMs
                  ? `${(synthesis.latencyMs / 1000).toFixed(1)}s`
                  : "?s"}{" "}
                ·{" "}
                <span className="font-mono">{synthesis.model ?? "?"}</span>
              </span>
            )}
            {!synthesis && (
              <span className="text-xs text-slate-500">
                ~30–90s. Uses the synthesis model chain.
              </span>
            )}
          </div>
          {synthesis?.status === "error" && synthesis.error && (
            <p className="text-xs text-rose-700 line-clamp-2">
              {synthesis.error}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasResult && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
            >
              <Download className="size-3.5" />
              Download as Markdown
            </button>
          )}
          <button
            type="button"
            onClick={onRun}
            disabled={disabled || running}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-colors",
              disabled || running
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            )}
          >
            {running ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating…
              </>
            ) : hasResult ? (
              <>
                <RefreshCw className="size-4" />
                Regenerate memo
              </>
            ) : (
              <>
                <Play className="size-4" />
                Generate evaluation memo
              </>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function MemoDocument({ memo }: { memo: EvaluationMemo }) {
  return (
    <article className="bg-white border border-slate-200 rounded-lg p-10 sm:p-12 shadow-sm">
      <header className="mb-8 pb-6 border-b border-slate-200">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-3">
          {memo.title}
        </h1>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
          <MetaCell label="Date" value={memo.date} />
          <MetaCell label="Prepared for" value={memo.prepared_for} />
          <MetaCell label="RFP" value={memo.rfp_reference} />
        </dl>
      </header>

      <section className="my-6">
        <div className="bg-slate-50 border-l-4 border-indigo-600 p-4 rounded-r">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 mb-1.5">
            Executive summary
          </p>
          <p className="text-base text-slate-900 leading-relaxed">
            {memo.executive_summary}
          </p>
        </div>
      </section>

      <section className="my-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-3">
          Recommendation
        </h2>
        <p className="text-slate-800 leading-relaxed">{memo.recommendation}</p>
        {memo.recommendation_caveats.length > 0 && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-2">
              Caveats
            </p>
            <ul className="space-y-1.5">
              {memo.recommendation_caveats.map((c, i) => (
                <li
                  key={i}
                  className="text-sm text-amber-900 leading-relaxed flex items-start gap-2"
                >
                  <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {memo.sections.map((section, i) => (
        <MemoSectionBlock key={i} section={section} />
      ))}

      {memo.open_questions.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            Open questions before final selection
          </h2>
          <ol className="list-decimal list-inside space-y-2">
            {memo.open_questions.map((q, i) => (
              <li key={i} className="text-slate-800 leading-relaxed">
                {q}
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="mt-12 pt-6 border-t border-slate-200">
        <pre className="font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
          {memo.signatures_block}
        </pre>
      </footer>
    </article>
  );
}

function MemoSectionBlock({ section }: { section: MemoSection }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-3">
        {section.heading}
      </h2>
      <div className="text-slate-800 leading-relaxed space-y-3 whitespace-pre-wrap">
        {section.body}
      </div>
      {section.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {section.citations.map((c, i) => (
            <CitationChip key={i} citation={c} />
          ))}
        </div>
      )}
    </section>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-slate-900">{value}</dd>
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

function StatusPill({
  status,
}: {
  status: SynthesisRecord["status"] | "absent";
}) {
  if (status === "absent") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
        Not generated
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

function memoToMarkdown(memo: EvaluationMemo): string {
  const lines: string[] = [];
  lines.push(`# ${memo.title}`, "");
  lines.push(`- **Date:** ${memo.date}`);
  lines.push(`- **Prepared for:** ${memo.prepared_for}`);
  lines.push(`- **RFP reference:** ${memo.rfp_reference}`, "");
  lines.push(`## Executive summary`, "", memo.executive_summary, "");
  lines.push(`## Recommendation`, "", memo.recommendation, "");
  if (memo.recommendation_caveats.length > 0) {
    lines.push(`### Caveats`);
    for (const c of memo.recommendation_caveats) lines.push(`- ${c}`);
    lines.push("");
  }
  for (const s of memo.sections) {
    lines.push(`## ${s.heading}`, "", s.body, "");
    if (s.citations.length > 0) {
      lines.push(
        `_Citations: ${s.citations
          .map((c) => `p.${c.page} "${c.verbatim_excerpt.replace(/"/g, '\\"')}"`)
          .join("; ")}_`,
        ""
      );
    }
  }
  if (memo.open_questions.length > 0) {
    lines.push(`## Open questions before final selection`, "");
    memo.open_questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push("");
  }
  lines.push(`---`, "", "```", memo.signatures_block, "```", "");
  return lines.join("\n");
}

function downloadMarkdown(memo: EvaluationMemo) {
  const md = memoToMarkdown(memo);
  const filename = `${(memo.title || "evaluation-memo").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.md`;
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("Memo downloaded as Markdown");
}
