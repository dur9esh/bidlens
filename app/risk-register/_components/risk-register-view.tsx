"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/app/_components/page-header";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EvaluationRecord } from "@/lib/evaluation/dao";
import type { Citation } from "@/lib/ingestion/types";
import type { SynthesisRecord } from "@/lib/synthesis/dao";
import type {
  RiskCategory,
  RiskItem,
  RiskRegister,
} from "@/lib/synthesis/risk-types";

const ALL_CATEGORIES: RiskCategory[] = [
  "contractual",
  "compliance",
  "data_handling",
  "technical_capability",
  "vendor_viability",
  "implementation",
  "operational",
  "other",
];

const ALL_SEVERITIES = ["high", "medium", "low"] as const;
type Severity = (typeof ALL_SEVERITIES)[number];

export function RiskRegisterView({
  initialRegister,
  comparative,
  evaluations,
}: {
  initialRegister: SynthesisRecord | null;
  comparative: SynthesisRecord | null;
  evaluations: EvaluationRecord[];
}) {
  const [register, setRegister] = useState<SynthesisRecord | null>(
    initialRegister
  );
  const [running, setRunning] = useState(false);

  const hasComparative = comparative?.status === "complete";
  const completeCount = evaluations.filter(
    (e) => e.status === "complete"
  ).length;
  const evaluationsReady = completeCount >= 9;
  const ready = hasComparative && evaluationsReady;

  async function runRegister() {
    if (running) return;
    setRunning(true);
    setRegister((prev) => ({
      id: prev?.id ?? "local-risk-register",
      kind: "risk_register",
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
      const res = await fetch("/api/synthesis/risk_register", {
        method: "POST",
      });
      const body = (await res.json()) as
        | SynthesisRecord
        | { error: string };
      if (!res.ok) {
        if ("status" in body) {
          setRegister(body);
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        throw new Error(
          ("error" in body && body.error) || `HTTP ${res.status}`
        );
      }
      if (!("status" in body))
        throw new Error("Unexpected response shape");
      setRegister(body);
      if (body.status === "complete") {
        const resultRisks =
          (body.result as RiskRegister | null)?.risks?.length ?? 0;
        toast.success(
          `Risk register generated: ${resultRisks} risks (${body.latencyMs ? (body.latencyMs / 1000).toFixed(1) : "?"}s)`
        );
      } else if (body.status === "error") {
        toast.error(body.error ?? "Risk register generation failed");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Risk register generation failed";
      toast.error(message);
      setRegister((prev) => ({
        ...(prev ?? {
          id: "local-risk-register",
          kind: "risk_register",
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
    register?.status === "complete" && register.result
      ? (register.result as RiskRegister)
      : null;

  return (
    <div className="flex-1">
      <main className="max-w-6xl mx-auto px-6 pb-12 space-y-8">
        <PageHeader
          eyebrow="Artifacts · Structured Risks"
          title="Risk Register"
          subtitle="Structured risks across the vendor selection, each with severity, likelihood, citation, and recommended mitigation."
        />

        {!ready && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="font-medium">
                Risk register generation needs the upstream artifacts complete.
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
          synthesis={register}
          running={running}
          disabled={!ready}
          onRun={runRegister}
          hasResult={!!result}
          onExport={() => result && exportCsv(result)}
        />

        {!result && ready && (
          <Card className="shadow-sm border-slate-200/80">
            <CardContent className="py-12 text-center text-slate-500 space-y-2">
              <p>
                Generate the risk register to see the structured risk table.
              </p>
              <p className="text-xs">
                Typically 8–15 risks across vendor-specific and class-level
                concerns, each with citation and recommended mitigation.
              </p>
            </CardContent>
          </Card>
        )}

        {result && <RegisterTable register={result} />}
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
  onExport,
}: {
  synthesis: SynthesisRecord | null;
  running: boolean;
  disabled: boolean;
  onRun: () => void;
  hasResult: boolean;
  onExport: () => void;
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
              onClick={onExport}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
            >
              <Download className="size-3.5" />
              Export as CSV
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
                Regenerate
              </>
            ) : (
              <>
                <Play className="size-4" />
                Generate risk register
              </>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function RegisterTable({ register }: { register: RiskRegister }) {
  const [selectedCategories, setSelectedCategories] = useState<Set<RiskCategory>>(
    new Set(ALL_CATEGORIES)
  );
  const [selectedSeverities, setSelectedSeverities] = useState<Set<Severity>>(
    new Set(ALL_SEVERITIES)
  );

  const allVendorIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of register.risks)
      for (const v of r.affected_vendor_ids) set.add(v);
    return Array.from(set);
  }, [register.risks]);

  const allVendorNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of register.risks) {
      r.affected_vendor_ids.forEach((id, i) => {
        if (!map[id]) map[id] = r.affected_vendor_names[i] ?? id;
      });
    }
    return map;
  }, [register.risks]);

  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(
    new Set(allVendorIds)
  );
  const [includeClassLevel, setIncludeClassLevel] = useState(true);

  const filtered = useMemo(() => {
    return register.risks.filter((r) => {
      if (!selectedCategories.has(r.category)) return false;
      if (!selectedSeverities.has(r.severity)) return false;
      // vendor filter
      if (r.affected_vendor_ids.length === 0) return includeClassLevel;
      return r.affected_vendor_ids.some((id) => selectedVendorIds.has(id));
    });
  }, [
    register.risks,
    selectedCategories,
    selectedSeverities,
    selectedVendorIds,
    includeClassLevel,
  ]);

  function toggleCategory(c: RiskCategory) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }
  function toggleSeverity(s: Severity) {
    setSelectedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }
  function toggleVendor(id: string) {
    setSelectedVendorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <Card className="shadow-sm border-slate-200/80">
        <CardContent className="pt-6 space-y-1">
          <p className="font-sans text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
            Summary
          </p>
          <p className="text-sm text-slate-800 leading-relaxed">
            {register.summary}
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200/80">
        <CardContent className="pt-6 space-y-4">
          <FilterGroup label="Severity">
            {ALL_SEVERITIES.map((s) => (
              <FilterChip
                key={s}
                active={selectedSeverities.has(s)}
                onClick={() => toggleSeverity(s)}
                className={severityChipColor(s)}
              >
                {s}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Category">
            {ALL_CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                active={selectedCategories.has(c)}
                onClick={() => toggleCategory(c)}
              >
                {c.replaceAll("_", " ")}
              </FilterChip>
            ))}
          </FilterGroup>
          {allVendorIds.length > 0 && (
            <FilterGroup label="Affecting vendor">
              {allVendorIds.map((id) => (
                <FilterChip
                  key={id}
                  active={selectedVendorIds.has(id)}
                  onClick={() => toggleVendor(id)}
                >
                  {allVendorNames[id] ?? id}
                </FilterChip>
              ))}
              <FilterChip
                active={includeClassLevel}
                onClick={() => setIncludeClassLevel((v) => !v)}
              >
                Class-level
              </FilterChip>
            </FilterGroup>
          )}
          <p className="text-xs text-slate-500">
            Showing {filtered.length} of {register.risks.length} risks
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-8 px-2 py-2"></th>
                <th className="text-left px-3 py-2 font-medium">Severity</th>
                <th className="text-left px-3 py-2 font-medium">Likelihood</th>
                <th className="text-left px-3 py-2 font-medium">Risk</th>
                <th className="text-left px-3 py-2 font-medium">Category</th>
                <th className="text-left px-3 py-2 font-medium">Affecting</th>
                <th className="text-left px-3 py-2 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8 text-sm text-slate-500"
                  >
                    No risks match the active filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => <RiskRow key={r.id} risk={r} />)
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function RiskRow({ risk }: { risk: RiskItem }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className="border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-2 py-2 align-top text-slate-400">
          {open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </td>
        <td className="px-3 py-2 align-top">
          <SeverityChip severity={risk.severity} />
        </td>
        <td className="px-3 py-2 align-top">
          <LikelihoodChip likelihood={risk.likelihood} />
        </td>
        <td className="px-3 py-2 align-top">
          <p className="font-medium text-slate-900">{risk.title}</p>
          {!open && (
            <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
              {risk.description}
            </p>
          )}
        </td>
        <td className="px-3 py-2 align-top">
          <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 capitalize">
            {risk.category.replaceAll("_", " ")}
          </span>
        </td>
        <td className="px-3 py-2 align-top text-xs">
          {risk.affected_vendor_names.length === 0 ? (
            <span className="inline-flex items-center rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-indigo-700">
              Class-level
            </span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {risk.affected_vendor_names.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-indigo-700"
                >
                  {n}
                </span>
              ))}
            </div>
          )}
        </td>
        <td className="px-3 py-2 align-top text-xs text-slate-700">
          {risk.owner_suggestion}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-slate-100 bg-slate-50/40">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-sans text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase mb-1">
                  Description
                </p>
                <p className="text-slate-800 leading-relaxed">
                  {risk.description}
                </p>
              </div>
              <div>
                <p className="font-sans text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase mb-1">
                  Recommended mitigation
                </p>
                <p className="text-slate-800 leading-relaxed">
                  {risk.recommended_mitigation}
                </p>
              </div>
            </div>
            {risk.citations.length > 0 && (
              <div className="mt-3">
                <p className="font-sans text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase mb-1.5">
                  Citations
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {risk.citations.map((c, i) => (
                    <CitationChip key={i} citation={c} />
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="font-sans text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase mr-1">
        {label}:
      </span>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-colors",
        active
          ? className ?? "bg-indigo-50 text-indigo-700 border-indigo-200"
          : "bg-white text-slate-400 border-slate-200 hover:text-slate-600"
      )}
    >
      {children}
    </button>
  );
}

function SeverityChip({ severity }: { severity: RiskItem["severity"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        severityChipColor(severity)
      )}
    >
      {severity}
    </span>
  );
}

function LikelihoodChip({
  likelihood,
}: {
  likelihood: RiskItem["likelihood"];
}) {
  const cls =
    likelihood === "high"
      ? "bg-rose-50 text-rose-700 border border-rose-200"
      : likelihood === "medium"
        ? "bg-amber-50 text-amber-700 border border-amber-200"
        : "bg-slate-50 text-slate-600 border border-slate-200";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize",
        cls
      )}
    >
      {likelihood}
    </span>
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

function severityChipColor(severity: Severity): string {
  if (severity === "high") return "bg-rose-100 text-rose-800 border-rose-200";
  if (severity === "medium")
    return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
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

function csvField(v: string | number | string[] | null | undefined): string {
  if (v == null) return "";
  if (Array.isArray(v)) v = v.join("; ");
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCsv(register: RiskRegister) {
  const headers = [
    "id",
    "title",
    "category",
    "severity",
    "likelihood",
    "affected_vendor_names",
    "description",
    "recommended_mitigation",
    "owner_suggestion",
    "citations",
  ];
  const lines = [headers.join(",")];
  for (const r of register.risks) {
    lines.push(
      [
        csvField(r.id),
        csvField(r.title),
        csvField(r.category),
        csvField(r.severity),
        csvField(r.likelihood),
        csvField(r.affected_vendor_names),
        csvField(r.description),
        csvField(r.recommended_mitigation),
        csvField(r.owner_suggestion),
        csvField(
          r.citations.map((c) => `p.${c.page}: ${c.verbatim_excerpt}`).join(" | ")
        ),
      ].join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "risk-register.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("Risk register exported as CSV");
}
