export interface Criterion {
  /** Stable URL-safe ID, e.g., "ehr-integration". */
  id: string;
  /** Display name, e.g., "EHR integration depth". */
  name: string;
  /** One- to two-sentence description used in the UI and passed to the evaluator agent. */
  description: string;
  /** Weight as a percentage within the parent category. Criteria within a category should sum to 100. */
  weight: number;
}

export interface Category {
  id: string;
  name: string;
  /** Weight as a percentage of total score. Categories should sum to 100. */
  weight: number;
  /** Brief framing used in the UI and surfaced to the evaluator agent for context. */
  description: string;
  criteria: Criterion[];
}

export interface HardRequirement {
  id: string;
  name: string;
  description: string;
  /** Whether this hard requirement is currently enforced. Disabling lets users explore "what if" scenarios. */
  enabled: boolean;
}

export interface ScoringScale {
  min: number;
  max: number;
  description: string;
}

export interface RubricContent {
  categories: Category[];
  hardRequirements: HardRequirement[];
  scoringScale: ScoringScale;
}

export interface Rubric {
  id: string;
  name: string;
  description: string;
  content: RubricContent;
  updatedAt: string; // ISO date string
}

/** ID of the default rubric BidLens seeds on first load. */
export const DEFAULT_RUBRIC_ID = "default-healthcare-rfp";
