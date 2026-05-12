import Anthropic from "@anthropic-ai/sdk";

/**
 * Model IDs used throughout BidLens.
 *
 * - SONNET: workhorse for ingestion, per-vendor evaluation, Q&A.
 * - OPUS: cross-vendor synthesis and memo generation.
 *
 * Constraints to remember when adding new call sites:
 * - claude-opus-4-7 REJECTS non-default `temperature`, `top_p`, `top_k`
 *   (returns 400). Omit these parameters entirely.
 * - claude-opus-4-7 has adaptive thinking OFF by default; enable
 *   explicitly with `thinking: { type: "adaptive" }` when needed.
 */
export const MODELS = {
  SONNET: "claude-sonnet-4-6",
  OPUS: "claude-opus-4-7",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

let _client: Anthropic | null = null;

/**
 * Lazy-initialized Anthropic client. Throws when called without
 * ANTHROPIC_API_KEY set, not at module load time, so dev-server
 * doesn't crash on a missing env var.
 */
export function getClaude(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local for local dev " +
          "and to Vercel project environment variables for deployments."
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

/**
 * Convenience helper that extracts plain text from a Claude response.
 * Most BidLens endpoints will use structured outputs (tool use) instead,
 * but this is useful for the health check and any free-form Q&A.
 */
export function extractText(
  content: Anthropic.Messages.ContentBlock[]
): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
