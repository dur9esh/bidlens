import { DEMO_DOCUMENTS } from "@/lib/documents";
import { listIngestions } from "@/lib/ingestion/dao";

import { IngestionsBoard } from "./_components/ingestions-board";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ingestions — BidLens",
  description:
    "Run document ingestion agents over the RFP and vendor bids; inspect the structured output.",
};

export default async function IngestionsPage() {
  const ingestions = await listIngestions();
  return (
    <IngestionsBoard
      documents={DEMO_DOCUMENTS}
      initialIngestions={ingestions}
    />
  );
}
