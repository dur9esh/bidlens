import { getBids } from "@/lib/documents";
import { listEvaluations } from "@/lib/evaluation/dao";
import { listIngestions } from "@/lib/ingestion/dao";

import { EvaluationsBoard } from "./_components/evaluations-board";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Evaluations — BidLens",
  description:
    "Run the per-vendor scoring agents (Technical now; Commercial and Compliance follow) and inspect the scorecards.",
};

export default async function EvaluationsPage() {
  const bids = getBids();
  const evaluations = await listEvaluations();
  const ingestions = await listIngestions();
  return (
    <EvaluationsBoard
      bids={bids}
      initialEvaluations={evaluations}
      ingestions={ingestions}
    />
  );
}
