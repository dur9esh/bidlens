"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/app/_components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DemoDocument } from "@/lib/documents";
import type { IngestionRecord } from "@/lib/ingestion/dao";

type Status = IngestionRecord["status"] | "absent";

export function IngestionsBoard({
  documents,
  initialIngestions,
}: {
  documents: DemoDocument[];
  initialIngestions: IngestionRecord[];
}) {
  const initialMap = useMemo(() => {
    const m: Record<string, IngestionRecord> = {};
    for (const r of initialIngestions) m[r.documentId] = r;
    return m;
  }, [initialIngestions]);

  const [records, setRecords] = useState<Record<string, IngestionRecord>>(
    initialMap
  );
  const [running, setRunning] = useState<Record<string, boolean>>({});

  async function runIngestion(doc: DemoDocument) {
    if (running[doc.id]) return;
    setRunning((r) => ({ ...r, [doc.id]: true }));
    // Optimistic placeholder
    setRecords((prev) => ({
      ...prev,
      [doc.id]: {
        ...(prev[doc.id] ?? {
          id: `local-${doc.id}`,
          documentId: doc.id,
          documentKind: doc.kind,
          model: null,
          inputTokens: null,
          outputTokens: null,
          latencyMs: null,
          result: null,
          error: null,
          updatedAt: new Date().toISOString(),
        }),
        status: "running",
        error: null,
      },
    }));

    try {
      const res = await fetch(`/api/ingestions/${doc.id}`, { method: "POST" });
      const body = (await res.json()) as IngestionRecord | { error: string };
      if (!res.ok) {
        if ("status" in body) {
          // Server returned an IngestionRecord with status="error" — capture it.
          setRecords((prev) => ({ ...prev, [doc.id]: body }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        throw new Error(("error" in body && body.error) || `HTTP ${res.status}`);
      }
      if (!("status" in body)) {
        throw new Error("Unexpected response shape");
      }
      setRecords((prev) => ({ ...prev, [doc.id]: body }));
      const seconds = body.latencyMs ? (body.latencyMs / 1000).toFixed(1) : "?";
      if (body.status === "complete") {
        toast.success(`Ingested ${doc.title} in ${seconds}s`);
      } else if (body.status === "error") {
        toast.error(body.error ?? "Ingestion failed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ingestion failed";
      toast.error(message);
      setRecords((prev) => ({
        ...prev,
        [doc.id]: {
          ...(prev[doc.id] ?? {
            id: `local-${doc.id}`,
            documentId: doc.id,
            documentKind: doc.kind,
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
      setRunning((r) => ({ ...r, [doc.id]: false }));
    }
  }

  const allComplete = documents.every(
    (d) => records[d.id]?.status === "complete"
  );

  return (
    <div className="flex-1">
      <main className="max-w-5xl mx-auto px-6 pb-16 space-y-10">
        <PageHeader
          eyebrow="Evaluation · Structured Extraction"
          title="Ingestions"
          subtitle="BidLens reads each document with Gemini and extracts structured data with citations back to source text. Calls route through a fallback chain (flash-lite → flash → pro); the model that actually served each run is shown in the metadata line. Re-running replaces the prior result."
        />

        {allComplete && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
            All documents ingested. Ready for per-vendor evaluation in PR 5.
          </div>
        )}

        <Card className="shadow-sm border-slate-200/80">
          <CardHeader>
            <CardTitle className="text-slate-900 text-lg">Documents</CardTitle>
            <p className="text-sm text-slate-500">
              {documents.length} documents · click Ingest to run the agent
              against that PDF.
            </p>
          </CardHeader>
          <CardContent className="space-y-0">
            {documents.map((doc, idx) => {
              const record = records[doc.id];
              const status: Status = record?.status ?? "absent";
              return (
                <div key={doc.id}>
                  {idx > 0 && <Separator className="my-4" />}
                  <DocumentRow
                    doc={doc}
                    status={status}
                    record={record}
                    isRunning={!!running[doc.id]}
                    onRun={() => runIngestion(doc)}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function DocumentRow({
  doc,
  status,
  record,
  isRunning,
  onRun,
}: {
  doc: DemoDocument;
  status: Status;
  record: IngestionRecord | undefined;
  isRunning: boolean;
  onRun: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900">{doc.title}</p>
          <p className="text-xs text-slate-500">{doc.subtitle}</p>
          {record?.status === "complete" && (
            <p className="mt-1 text-xs text-slate-500">
              {record.inputTokens?.toLocaleString() ?? "?"} input ·{" "}
              {record.outputTokens?.toLocaleString() ?? "?"} output tokens ·{" "}
              {record.latencyMs
                ? `${(record.latencyMs / 1000).toFixed(1)}s`
                : "?s"}{" "}
              · <span className="font-mono">{record.model}</span>
            </p>
          )}
          {record?.status === "error" && record.error && (
            <p className="mt-1 text-xs text-rose-700 line-clamp-2">
              {record.error}
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

      {record?.status === "complete" && record.result != null && (
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
              {open ? "Hide structured output" : "View structured output"}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 font-mono text-xs leading-relaxed bg-slate-50 p-4 rounded-lg max-h-[600px] overflow-auto border border-slate-200">
              {JSON.stringify(record.result, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status === "absent") {
    return (
      <span className="shrink-0 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
        Not ingested
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
        <CheckCircle className="size-3" />
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
  const isReingest = status === "complete" || status === "error";

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
      ) : isReingest ? (
        <>
          <RefreshCw className="size-3.5" />
          Re-ingest
        </>
      ) : (
        <>
          <Play className="size-3.5" />
          Ingest
        </>
      )}
    </button>
  );
}
