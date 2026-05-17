"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AuditEventRecord } from "@/lib/audit/dao";
import type { AuditEventType } from "@/lib/audit/log";

const EVENT_TYPE_COLORS: Record<string, string> = {
  "ingestion.run": "bg-slate-100 text-slate-700 border-slate-200",
  "evaluation.run": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "synthesis.run": "bg-purple-50 text-purple-700 border-purple-200",
  "qa.run": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "rubric.update": "bg-amber-50 text-amber-800 border-amber-200",
  "rubric.reset": "bg-amber-50 text-amber-800 border-amber-200",
};

const ALL_EVENT_TYPES: AuditEventType[] = [
  "ingestion.run",
  "evaluation.run",
  "synthesis.run",
  "qa.run",
  "rubric.update",
  "rubric.reset",
];

const ALL_STATUSES = ["complete", "error"] as const;
type StatusFilter = (typeof ALL_STATUSES)[number];

export function AuditView({
  initialEvents,
}: {
  initialEvents: AuditEventRecord[];
}) {
  const [events, setEvents] = useState<AuditEventRecord[]>(initialEvents);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(ALL_EVENT_TYPES)
  );
  const [selectedStatuses, setSelectedStatuses] = useState<Set<StatusFilter>>(
    new Set(ALL_STATUSES)
  );

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/audit");
      const body = (await res.json()) as
        | AuditEventRecord[]
        | { error: string };
      if (!res.ok || !Array.isArray(body)) {
        throw new Error(
          (!Array.isArray(body) && body.error) || `HTTP ${res.status}`
        );
      }
      setEvents(body);
      toast.success(`${body.length} events`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  function toggleType(t: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }
  function toggleStatus(s: StatusFilter) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (!selectedTypes.has(e.eventType)) return false;
        if (e.status && !selectedStatuses.has(e.status as StatusFilter))
          return false;
        return true;
      }),
    [events, selectedTypes, selectedStatuses]
  );

  const stats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalLatency = 0;
    const byType: Record<string, number> = {};
    for (const e of events) {
      byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;
      totalIn += e.inputTokens ?? 0;
      totalOut += e.outputTokens ?? 0;
      totalLatency += e.latencyMs ?? 0;
    }
    return { total: events.length, byType, totalIn, totalOut, totalLatency };
  }, [events]);

  return (
    <div className="flex-1">
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="size-4" />
            BidLens
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Audit Trail
          </h1>
          <p className="text-slate-600 max-w-3xl">
            Every agent action and state change, in chronological order. The
            defensibility surface — how a compliance auditor reconstructs the
            decision.
          </p>
        </div>

        <Card className="shadow-sm border-slate-200/80">
          <CardContent className="pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
              <Stat label="Total events" value={stats.total} />
              <Stat label="Ingestions" value={stats.byType["ingestion.run"] ?? 0} />
              <Stat
                label="Evaluations"
                value={stats.byType["evaluation.run"] ?? 0}
              />
              <Stat label="Syntheses" value={stats.byType["synthesis.run"] ?? 0} />
              <Stat label="Q&A turns" value={stats.byType["qa.run"] ?? 0} />
              <Stat
                label="Aggregate tokens"
                value={(stats.totalIn + stats.totalOut).toLocaleString()}
              />
              <Stat
                label="Aggregate latency"
                value={`${(stats.totalLatency / 1000).toFixed(1)}s`}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => exportJson(events)}
                disabled={events.length === 0}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium transition-colors",
                  events.length === 0
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                )}
              >
                <Download className="size-3.5" />
                Export as JSON
              </button>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("size-3.5", refreshing && "animate-spin")}
                />
                Refresh
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200/80">
          <CardContent className="pt-6 space-y-3">
            <FilterGroup label="Event type">
              {ALL_EVENT_TYPES.map((t) => (
                <FilterChip
                  key={t}
                  active={selectedTypes.has(t)}
                  onClick={() => toggleType(t)}
                  className={EVENT_TYPE_COLORS[t]}
                >
                  {t}
                </FilterChip>
              ))}
            </FilterGroup>
            <FilterGroup label="Status">
              {ALL_STATUSES.map((s) => (
                <FilterChip
                  key={s}
                  active={selectedStatuses.has(s)}
                  onClick={() => toggleStatus(s)}
                  className={
                    s === "complete"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-rose-100 text-rose-800 border-rose-200"
                  }
                >
                  {s}
                </FilterChip>
              ))}
            </FilterGroup>
            <p className="text-xs text-slate-500">
              Showing {filtered.length} of {events.length} events
            </p>
          </CardContent>
        </Card>

        {events.length === 0 ? (
          <Card className="shadow-sm border-slate-200/80">
            <CardContent className="py-12 text-center text-slate-500 text-sm">
              No audit events recorded yet. Run an ingestion, evaluation,
              synthesis, or Q&amp;A to populate the trail.
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-8 px-2 py-2"></th>
                    <th className="text-left px-3 py-2 font-medium">When</th>
                    <th className="text-left px-3 py-2 font-medium">Event</th>
                    <th className="text-left px-3 py-2 font-medium">
                      Resource
                    </th>
                    <th className="text-left px-3 py-2 font-medium">Actor</th>
                    <th className="text-left px-3 py-2 font-medium">Model</th>
                    <th className="text-left px-3 py-2 font-medium">Tokens</th>
                    <th className="text-left px-3 py-2 font-medium">
                      Latency
                    </th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

function EventRow({ event }: { event: AuditEventRecord }) {
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
        <td className="px-3 py-2 align-top text-xs">
          <span title={event.createdAt}>{timeAgo(event.createdAt)}</span>
        </td>
        <td className="px-3 py-2 align-top">
          <span
            className={cn(
              "inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono",
              EVENT_TYPE_COLORS[event.eventType] ??
                "bg-slate-100 text-slate-700 border-slate-200"
            )}
          >
            {event.eventType}
          </span>
        </td>
        <td className="px-3 py-2 align-top text-xs text-slate-700">
          {event.resourceKind ? (
            <span>
              <span className="text-slate-400">{event.resourceKind}</span>
              {" · "}
              <span className="font-mono">{event.resourceId ?? "?"}</span>
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-3 py-2 align-top text-xs text-slate-700">
          {event.actor}
        </td>
        <td className="px-3 py-2 align-top text-xs font-mono text-slate-700">
          {event.model ?? "—"}
        </td>
        <td className="px-3 py-2 align-top text-xs font-mono text-slate-700 tabular-nums">
          {event.inputTokens != null || event.outputTokens != null
            ? `${(event.inputTokens ?? 0).toLocaleString()} → ${(event.outputTokens ?? 0).toLocaleString()}`
            : "—"}
        </td>
        <td className="px-3 py-2 align-top text-xs font-mono text-slate-700 tabular-nums">
          {event.latencyMs != null
            ? `${(event.latencyMs / 1000).toFixed(1)}s`
            : "—"}
        </td>
        <td className="px-3 py-2 align-top">
          {event.status === "complete" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="size-3" />
              complete
            </span>
          )}
          {event.status === "error" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
              <AlertCircle className="size-3" />
              error
            </span>
          )}
          {!event.status && (
            <span className="text-slate-400 text-xs">—</span>
          )}
        </td>
      </tr>
      {open && (
        <tr className="border-t border-slate-100 bg-slate-50/40">
          <td colSpan={9} className="px-4 py-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Metadata
              </p>
              <pre className="font-mono text-xs leading-relaxed bg-white border border-slate-200 p-3 rounded overflow-auto">
                {JSON.stringify(
                  {
                    id: event.id,
                    timestamp: event.createdAt,
                    metadata: event.metadata ?? {},
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="font-mono text-slate-900 tabular-nums">{value}</div>
    </div>
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
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono transition-colors",
        active
          ? className ?? "bg-indigo-50 text-indigo-700 border-indigo-200"
          : "bg-white text-slate-400 border-slate-200 hover:text-slate-600"
      )}
    >
      {children}
    </button>
  );
}

function timeAgo(iso: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 1000
  );
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function exportJson(events: AuditEventRecord[]) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([JSON.stringify(events, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bidlens-audit-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("Audit trail exported as JSON");
}
