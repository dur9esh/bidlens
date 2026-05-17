import { NextRequest, NextResponse } from "next/server";

import { logAuditEvent } from "@/lib/audit/log";
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
    const run =
      doc.kind === "rfp"
        ? await ingestRfp(doc.filename)
        : await ingestBid(doc.filename);

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
    await logAuditEvent({
      eventType: "ingestion.run",
      resourceKind: "document",
      resourceId: doc.id,
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      latencyMs: run.latencyMs,
      status: "complete",
      metadata: { document_kind: doc.kind, filename: doc.filename },
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
    await logAuditEvent({
      eventType: "ingestion.run",
      resourceKind: "document",
      resourceId: doc.id,
      status: "error",
      metadata: {
        document_kind: doc.kind,
        filename: doc.filename,
        error_message: message,
      },
    });
    return NextResponse.json(record, { status: 500 });
  }
}
