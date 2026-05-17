"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/app/_components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QaTurnRecord } from "@/lib/qa/dao";
import type { QaAnswerCitation } from "@/lib/qa/types";

const SUGGESTED_QUESTIONS = [
  "Which vendor has the strongest references for systems of our size?",
  "What would it take to make ScribeAI Health an acceptable choice?",
  "Why isn't ClinicalNote.ai recommended despite the lowest TCO?",
  "What clarification questions should we send to DocuMind Health before signing?",
  "How do the three vendors compare on data residency and BAA terms?",
  "Which risks should we address first if we proceed with DocuMind?",
];

const SOURCE_KIND_LABELS: Record<QaAnswerCitation["source_kind"], string> = {
  rfp: "RFP",
  bid: "Vendor bid",
  evaluation: "Evaluation",
  comparative_synthesis: "Comparative synthesis",
  memo: "Memo",
  risk_register: "Risk register",
};

function newSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ChatView() {
  const [sessionId, setSessionId] = useState<string>("");
  const [turns, setTurns] = useState<QaTurnRecord[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const optimisticCounter = useRef(0);

  // Auto-scroll on new turn.
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  }, [turns.length, running]);

  // Lazily generate the session ID on first submission. Avoids generating it
  // during render (hydration mismatch risk) and avoids setState-in-effect.
  function ensureSessionId(): string {
    if (sessionId) return sessionId;
    const id = newSessionId();
    setSessionId(id);
    return id;
  }

  function newSession() {
    setSessionId(newSessionId());
    setTurns([]);
    setInput("");
  }

  async function submit(question: string) {
    const q = question.trim();
    if (!q || running) return;

    const sid = ensureSessionId();
    setInput("");
    optimisticCounter.current += 1;
    const optimisticId = `local-${optimisticCounter.current}`;
    const optimistic: QaTurnRecord = {
      id: optimisticId,
      sessionId: sid,
      question: q,
      answer: null,
      citations: null,
      status: "running",
      model: null,
      inputTokens: null,
      outputTokens: null,
      latencyMs: null,
      error: null,
      createdAt: new Date().toISOString(),
    };
    setTurns((t) => [...t, optimistic]);
    setRunning(true);

    try {
      const res = await fetch(`/api/qa/${sid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = (await res.json()) as
        | QaTurnRecord
        | { error: string };
      if (!res.ok) {
        const msg =
          "status" in body
            ? body.error ?? "Q&A failed"
            : ("error" in body && body.error) || `HTTP ${res.status}`;
        if ("status" in body) {
          setTurns((t) =>
            t.map((x) => (x.id === optimisticId ? body : x))
          );
        }
        throw new Error(msg);
      }
      if (!("status" in body)) {
        throw new Error("Unexpected response shape");
      }
      setTurns((t) => t.map((x) => (x.id === optimisticId ? body : x)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Q&A failed";
      toast.error(message);
      setTurns((t) =>
        t.map((x) =>
          x.id === optimisticId
            ? { ...x, status: "error" as const, error: message }
            : x
        )
      );
    } finally {
      setRunning(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  }

  function handleSuggested(q: string) {
    setInput(q);
    setTimeout(() => submit(q), 0);
  }

  return (
    <div className="flex-1">
      <main className="max-w-3xl mx-auto px-6 pb-12 space-y-6">
        <PageHeader
          eyebrow="Observability · Interactive"
          title="Ask the agent"
          subtitle="Open-ended Q&A grounded in the full BidLens corpus — RFP, vendor bids, evaluations, memo, and risk register. Every answer is cited to its source."
        />

        {turns.length === 0 && (
          <Card className="shadow-sm border-slate-200/80">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2 font-sans text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                <Sparkles className="size-4 text-indigo-500" />
                Suggested questions
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSuggested(q)}
                    disabled={running}
                    className={cn(
                      "text-left text-sm rounded-full border px-3 py-1.5 transition-colors",
                      running
                        ? "border-slate-200 text-slate-400 cursor-not-allowed"
                        : "border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {turns.length > 0 && (
          <div className="space-y-5">
            {turns.map((turn) => (
              <TurnRow key={turn.id} turn={turn} />
            ))}
            <div ref={threadRef} />
          </div>
        )}

        <div className="sticky bottom-4">
          <Card className="shadow-md border-slate-200/80">
            <CardContent className="pt-4">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={
                    running
                      ? "Waiting for answer…"
                      : "Ask anything across the evaluation corpus…"
                  }
                  rows={1}
                  disabled={running}
                  className="flex-1 resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400 max-h-32"
                  style={{
                    minHeight: "2.5rem",
                  }}
                />
                <button
                  type="button"
                  onClick={() => submit(input)}
                  disabled={!input.trim() || running}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium shadow-sm transition-colors",
                    !input.trim() || running
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  )}
                >
                  {running ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Ask
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Enter to ask · Shift+Enter for newline · Routes through the
                  qa chain (flash-lite-led)
                </span>
                <button
                  type="button"
                  onClick={newSession}
                  disabled={running}
                  className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors disabled:text-slate-300"
                >
                  <RefreshCw className="size-3" />
                  New session
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function TurnRow({ turn }: { turn: QaTurnRecord }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="bg-indigo-600 text-white rounded-2xl px-4 py-3 max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap">
          {turn.question}
        </div>
      </div>
      <AssistantTurn turn={turn} />
    </div>
  );
}

function AssistantTurn({ turn }: { turn: QaTurnRecord }) {
  if (turn.status === "running" || turn.status === "pending") {
    return (
      <div className="flex justify-start">
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 max-w-[85%] flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Thinking…
        </div>
      </div>
    );
  }
  if (turn.status === "error") {
    return (
      <div className="flex justify-start">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 max-w-[85%] text-sm text-rose-800 flex items-start gap-2">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Couldn&apos;t answer that one.</p>
            <p className="text-xs mt-1">{turn.error}</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 max-w-[85%] space-y-2 text-sm">
        <p className="text-slate-900 leading-relaxed whitespace-pre-wrap">
          {turn.answer}
        </p>
        {turn.citations && turn.citations.length > 0 && (
          <div className="pt-1 flex flex-wrap gap-1.5">
            {turn.citations.map((c, i) => (
              <CitationChip key={i} citation={c} />
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-400 pt-1 flex items-center gap-1">
          <CheckCircle2 className="size-3 text-emerald-500" />
          <span className="font-mono">{turn.model ?? "?"}</span> ·{" "}
          {(turn.inputTokens ?? 0).toLocaleString()} →{" "}
          {(turn.outputTokens ?? 0).toLocaleString()} tokens ·{" "}
          {turn.latencyMs ? `${(turn.latencyMs / 1000).toFixed(1)}s` : "?s"}
        </p>
      </div>
    </div>
  );
}

function CitationChip({ citation }: { citation: QaAnswerCitation }) {
  const pagePart = citation.bid_citation
    ? ` · p.${citation.bid_citation.page}`
    : "";
  const tooltip = citation.bid_citation?.verbatim_excerpt ?? citation.excerpt;
  return (
    <span
      title={tooltip}
      className="inline-flex items-center bg-slate-100 text-slate-700 text-xs rounded px-2 py-0.5 cursor-help"
    >
      {SOURCE_KIND_LABELS[citation.source_kind]}: {citation.source_label}
      {pagePart}
    </span>
  );
}
