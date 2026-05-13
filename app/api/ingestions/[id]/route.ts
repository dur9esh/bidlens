import { NextRequest, NextResponse } from "next/server";

import { getDocument } from "@/lib/documents";
import { getIngestion, upsertIngestion } from "@/lib/ingestion/dao";
import { ingestBid } from "@/lib/ingestion/bid";
import { ingestRfp } from "@/lib/ingestion/rfp";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const record = await getIngestion(id);
    if (!record) return NextResponse.json(null);
    return NextResponse.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = getDocument(id);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await upsertIngestion({
    documentId: doc.id,
    documentKind: doc.kind,
    status: "running",
  });

  try {
    if (doc.kind === "rfp") {
      const run = await ingestRfp(doc.filename);
      const record = await upsertIngestion({
        documentId: doc.id,
        documentKind: doc.kind,
        status: "complete",
        model: run.model,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        latencyMs: run.latencyMs,
        result: run.result,
      });
      return NextResponse.json(record);
    }

    const run = await ingestBid(doc.filename);
    const record = await upsertIngestion({
      documentId: doc.id,
      documentKind: doc.kind,
      status: "complete",
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      latencyMs: run.latencyMs,
      result: run.result,
    });
    return NextResponse.json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Ingestion failed for ${doc.id}:`, err);
    const record = await upsertIngestion({
      documentId: doc.id,
      documentKind: doc.kind,
      status: "error",
      error: message,
    });
    return NextResponse.json(record, { status: 500 });
  }
}
