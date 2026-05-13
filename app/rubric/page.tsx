import { getDefaultRubric } from "@/lib/rubric/dao";
import { RubricEditor } from "./_components/rubric-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rubric — BidLens",
  description: "Configure how BidLens evaluates vendor bids against the RFP.",
};

export default async function RubricPage() {
  const rubric = await getDefaultRubric();
  return <RubricEditor initialRubric={rubric} />;
}
