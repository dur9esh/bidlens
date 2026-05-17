import { listAuditEvents } from "@/lib/audit/dao";

import { AuditView } from "./_components/audit-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit Trail — BidLens",
  description:
    "Every agent action and state change, in chronological order — the defensibility surface.",
};

export default async function AuditPage() {
  const events = await listAuditEvents(200);
  return <AuditView initialEvents={events} />;
}
