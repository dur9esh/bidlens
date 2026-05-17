import { listEvaluations } from "@/lib/evaluation/dao";
import { getSynthesis } from "@/lib/synthesis/dao";

import { RiskRegisterView } from "./_components/risk-register-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Risk Register — BidLens",
  description:
    "Structured risk register across the vendor selection, with severity, likelihood, recommended mitigations, and CSV export.",
};

export default async function RiskRegisterPage() {
  const [register, comparative, evaluations] = await Promise.all([
    getSynthesis("risk_register"),
    getSynthesis("comparative"),
    listEvaluations(),
  ]);
  return (
    <RiskRegisterView
      initialRegister={register}
      comparative={comparative}
      evaluations={evaluations}
    />
  );
}
