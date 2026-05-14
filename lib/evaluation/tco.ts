import type { BidIngestionResult } from "@/lib/ingestion/types";

/**
 * Normalized 3-year total cost of ownership for a vendor, computed on
 * consistent assumptions so vendors are comparable apples-to-apples.
 *
 * Assumptions (constant across all vendors):
 *  - 3,500 providers (from the RFP's stated footprint)
 *  - 3-year horizon
 *  - Year 1 subscription at the quoted rate; years 2-3 escalated by the
 *    vendor's stated annual escalation (0% if not stated)
 *  - Implementation is a one-time year-0 cost
 *  - Annual support applies each of the 3 years
 *
 * This is deterministic arithmetic — intentionally NOT an LLM task.
 */

const PROVIDER_COUNT = 3500;
const HORIZON_YEARS = 3;

export interface TcoBreakdown {
  vendor_name: string;
  provider_count: number;
  horizon_years: number;
  /** Year 1 annual subscription (provider_count × monthly rate × 12). */
  year1_subscription_usd: number | null;
  /** Sum of subscription across all 3 years, with escalation applied to years 2-3. */
  total_subscription_usd: number | null;
  /** One-time implementation cost. */
  implementation_usd: number | null;
  /** Annual support × 3 years. */
  total_support_usd: number | null;
  /** Grand total 3-year TCO. */
  normalized_3yr_tco_usd: number | null;
  /** The escalation rate used (decimal, e.g. 0.05 for 5%). */
  escalation_rate_applied: number;
  /** Notes on any assumptions made or data gaps encountered. */
  notes: string[];
}

export function computeTco(bid: BidIngestionResult): TcoBreakdown {
  const notes: string[] = [];
  const p = bid.pricing;
  const escalationPct = bid.contract_terms.price_escalation_percent_per_year;
  const escalationRate = escalationPct != null ? escalationPct / 100 : 0;
  if (escalationPct == null) {
    notes.push("No annual price escalation stated; assumed 0%.");
  }

  // Year 1 subscription: prefer the explicit annual total if given, else
  // compute from the per-provider monthly rate.
  let year1Subscription: number | null = null;
  if (p.annual_subscription_total_usd != null) {
    year1Subscription = p.annual_subscription_total_usd;
  } else if (p.subscription_per_provider_per_month_usd != null) {
    year1Subscription =
      p.subscription_per_provider_per_month_usd * PROVIDER_COUNT * 12;
    notes.push(
      "Annual subscription computed from per-provider monthly rate × 3,500 providers × 12."
    );
  } else {
    notes.push("No subscription pricing found in the bid.");
  }

  // Total subscription across 3 years with escalation on years 2 and 3.
  let totalSubscription: number | null = null;
  if (year1Subscription != null) {
    let running = 0;
    for (let year = 0; year < HORIZON_YEARS; year++) {
      running += year1Subscription * Math.pow(1 + escalationRate, year);
    }
    totalSubscription = Math.round(running);
  }

  const implementation = p.implementation_one_time_usd ?? null;
  if (implementation == null) {
    notes.push("No one-time implementation fee stated; treated as $0.");
  }

  let totalSupport: number | null = null;
  if (p.annual_support_usd != null) {
    totalSupport = p.annual_support_usd * HORIZON_YEARS;
  } else {
    notes.push(
      "No separate annual support fee stated; treated as $0 (assumed bundled)."
    );
  }

  let normalizedTco: number | null = null;
  if (totalSubscription != null) {
    normalizedTco =
      totalSubscription + (implementation ?? 0) + (totalSupport ?? 0);
  }

  return {
    vendor_name: bid.vendor_name,
    provider_count: PROVIDER_COUNT,
    horizon_years: HORIZON_YEARS,
    year1_subscription_usd: year1Subscription,
    total_subscription_usd: totalSubscription,
    implementation_usd: implementation,
    total_support_usd: totalSupport,
    normalized_3yr_tco_usd: normalizedTco,
    escalation_rate_applied: escalationRate,
    notes,
  };
}
