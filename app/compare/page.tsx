import { getBids } from "@/lib/documents";
import { listEvaluations } from "@/lib/evaluation/dao";
import { getDefaultRubric } from "@/lib/rubric/dao";
import { getSynthesis } from "@/lib/synthesis/dao";

import { ComparativeDashboard } from "./_components/comparative-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comparative Analysis — BidLens",
  description:
    "Cross-vendor synthesis powered by the highest-reasoning model in the routing policy.",
};

export default async function ComparePage() {
  const [evaluations, rubric, synthesis] = await Promise.all([
    listEvaluations(),
    getDefaultRubric(),
    getSynthesis("comparative"),
  ]);
  const bids = getBids();
  return (
    <ComparativeDashboard
      bids={bids}
      evaluations={evaluations}
      rubric={rubric}
      initialSynthesis={synthesis}
    />
  );
}
