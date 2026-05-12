import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, FileText, Hash, HardDrive } from "lucide-react";

import { DEMO_DOCUMENTS, getDocument } from "@/lib/documents";

export function generateStaticParams() {
  return DEMO_DOCUMENTS.map((d) => ({ id: d.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = getDocument(id);
  if (!doc) return { title: "Document not found — BidLens" };
  return {
    title: `${doc.title} — BidLens`,
    description: doc.summary,
  };
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = getDocument(id);
  if (!doc) notFound();

  const pdfUrl = `/demo-bids/${doc.filename}`;

  return (
    <div className="flex-1">
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <aside className="lg:col-span-1 space-y-6">
            <Link
              href="/documents"
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="size-4" />
              All documents
            </Link>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                {doc.title}
              </h1>
              <p className="text-sm text-slate-600">{doc.subtitle}</p>
            </div>

            <dl className="grid grid-cols-1 gap-3 text-sm">
              <MetaItem
                icon={<FileText className="size-4" />}
                label="Kind"
                value={doc.kind === "rfp" ? "RFP" : "Bid"}
              />
              {doc.vendor && (
                <MetaItem
                  icon={<FileText className="size-4" />}
                  label="Vendor"
                  value={doc.vendor}
                />
              )}
              <MetaItem
                icon={<Calendar className="size-4" />}
                label="Date"
                value={doc.date}
              />
              <MetaItem
                icon={<Hash className="size-4" />}
                label="Pages"
                value={`${doc.pageCount}`}
              />
              <MetaItem
                icon={<HardDrive className="size-4" />}
                label="Size"
                value={`${doc.sizeKb} KB`}
              />
            </dl>

            <div className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Summary
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed">
                {doc.summary}
              </p>
            </div>

            <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-indigo-700 mb-1">
                What&apos;s next
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                Document ingestion arrives in PR 4 — once shipped, you&apos;ll be
                able to extract structured data from this document with one
                click.
              </p>
            </div>
          </aside>

          <section className="lg:col-span-2">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              <iframe
                src={pdfUrl}
                title={doc.title}
                className="w-full min-h-[80vh] h-full"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Embedded PDF · <a
                href={pdfUrl}
                className="text-indigo-600 hover:text-indigo-700 underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >open in new tab</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </dt>
        <dd className="text-slate-900">{value}</dd>
      </div>
    </div>
  );
}
