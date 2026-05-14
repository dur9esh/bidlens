import { GoogleGenAI } from "@google/genai";

/**
 * Model IDs used throughout BidLens.
 *
 * BidLens's agent layer is provider-agnostic by design. It currently runs on
 * Google Gemini; the same agent decomposition could run on Anthropic Claude or
 * OpenAI with only this module changing.
 *
 * - FLASH: workhorse for ingestion, per-vendor evaluation, and Q&A.
 * - PRO:   reserved for cross-vendor synthesis and memo generation (later PRs).
 */
export const MODELS = {
  FLASH: "gemini-2.5-flash",
  PRO: "gemini-2.5-pro",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

let _client: GoogleGenAI | null = null;

/**
 * Lazy-initialized Gemini client. Throws when called without GEMINI_API_KEY,
 * not at module load time — so the dev server and unrelated routes still run
 * if the key is missing.
 */
export function getAI(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to Vercel project environment " +
          "variables (Production, Preview, Development)."
      );
    }
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

/**
 * Strip markdown code fences that some models occasionally wrap around JSON
 * output despite explicit instructions otherwise. Returns the raw text if no
 * fence is present.
 */
export function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}
