import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, FileText } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getBids, getRfp, type DemoDocument } from "@/lib/documents";

export const metadata = {
  title: "Documents — BidLens",
  description:
    "The healthcare procurement scenario BidLens evaluates: one RFP and three vendor responses.",
};

export default function DocumentsPage() {
  const rfp = getRfp();
  const bids = getBids();

  return (
    <div className="flex-1">
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="size-4" />
            BidLens
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Documents
          </h1>
          <p className="text-slate-600">
            The healthcare procurement scenario BidLens evaluates: one RFP
            and three vendor responses.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
            Request for Proposal
          </h2>
          <RfpCard doc={rfp} />
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
            Vendor bids
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bids.map((doc) => (
              <BidCard key={doc.id} doc={doc} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function RfpCard({ doc }: { doc: DemoDocument }) {
  return (
    <Card className="shadow-sm border-slate-200/80 border-l-4 border-l-indigo-600 bg-indigo-50/40">
      <CardHeader>
        <div className="flex items-start gap-3">
          <FileText className="size-5 mt-0.5 text-indigo-600 shrink-0" />
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-slate-900 text-lg leading-snug">
              {doc.title}
            </CardTitle>
            <p className="text-sm text-slate-600">{doc.subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-700 leading-relaxed">
          {doc.summary}
        </p>
        <DocMetaRow doc={doc} />
        <ViewLink id={doc.id} />
      </CardContent>
    </Card>
  );
}

function BidCard({ doc }: { doc: DemoDocument }) {
  return (
    <Card className="shadow-sm border-slate-200/80 bg-white flex flex-col">
      <CardHeader>
        <div className="flex items-start gap-3">
          <FileText className="size-5 mt-0.5 text-slate-400 shrink-0" />
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-slate-900 leading-snug">
              {doc.vendor}
            </CardTitle>
            <p className="text-xs text-slate-500">{doc.subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <p className="text-sm text-slate-700 leading-relaxed flex-1">
          {doc.summary}
        </p>
        <DocMetaRow doc={doc} />
        <ViewLink id={doc.id} />
      </CardContent>
    </Card>
  );
}

function DocMetaRow({ doc }: { doc: DemoDocument }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      <span>
        {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
      </span>
      <span aria-hidden>·</span>
      <span>{doc.sizeKb} KB</span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        <Calendar className="size-3" />
        {doc.date}
      </span>
    </div>
  );
}

function ViewLink({ id }: { id: string }) {
  return (
    <Link
      href={`/documents/${id}`}
      className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
    >
      View document
      <ArrowRight className="size-4" />
    </Link>
  );
}
