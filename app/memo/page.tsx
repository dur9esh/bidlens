import { listEvaluations } from "@/lib/evaluation/dao";
import { getSynthesis } from "@/lib/synthesis/dao";

import { MemoView } from "./_components/memo-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Evaluation Memo — BidLens",
  description:
    "Formal evaluation memo generated from the comparative synthesis, designed for procurement leadership review and archive.",
};

export default async function MemoPage() {
  const [memo, comparative, evaluations] = await Promise.all([
    getSynthesis("memo"),
    getSynthesis("comparative"),
    listEvaluations(),
  ]);
  return (
    <MemoView
      initialMemo={memo}
      comparative={comparative}
      evaluations={evaluations}
    />
  );
}
