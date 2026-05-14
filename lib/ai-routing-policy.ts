import type { ModelId, TaskType } from "./ai";
import { MODEL_CHAINS } from "./ai";

/**
 * Human-readable rationale for each task type's model chain.
 * Single source of truth for documentation and any UI that explains routing.
 */
export const ROUTING_RATIONALE: Record<
  TaskType,
  { label: string; demand: string; volume: string; rationale: string }
> = {
  ingestion: {
    label: "Document ingestion",
    demand: "Low — faithful extraction against an explicit schema",
    volume: "High — every document, plus re-runs",
    rationale:
      "Extraction is not a reasoning-heavy task. flash-lite handles it well and has the largest free-tier quota, so it leads. flash and pro back it up.",
  },
  evaluation: {
    label: "Per-vendor evaluation",
    demand: "Medium-high — scoring nuanced trade-offs against a rubric",
    volume: "Medium — one call per vendor per category",
    rationale:
      "Scoring judgment benefits from a stronger model, so flash leads. flash-lite is an acceptable degradation if flash is rate-limited; pro is the safety net.",
  },
  synthesis: {
    label: "Cross-vendor synthesis & memo",
    demand:
      "High — weighing vendors, surfacing non-obvious risks, drafting a defensible recommendation",
    volume: "Low — roughly two calls per evaluation",
    rationale:
      "The highest-reasoning step, but the lowest volume. pro leads because the quality matters most here and pro's small free-tier quota is sufficient at this call volume.",
  },
  qa: {
    label: "Ask-the-agent Q&A",
    demand: "Medium — grounded retrieval over the bid corpus",
    volume: "Variable — interactive, latency-sensitive",
    rationale:
      "Interactive use rewards low latency and high quota, so flash-lite leads. flash and pro back it up.",
  },
};

/** Returns the resolved chain for a task type. */
export function getChainFor(taskType: TaskType): ModelId[] {
  return MODEL_CHAINS[taskType];
}

/** Ordered list of task types for stable UI rendering. */
export const TASK_TYPES_IN_ORDER: TaskType[] = [
  "ingestion",
  "evaluation",
  "synthesis",
  "qa",
];
