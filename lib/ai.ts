import { GoogleGenAI } from "@google/genai";

/**
 * Model IDs used throughout BidLens.
 *
 * BidLens's agent layer is provider-agnostic and model-resilient. Calls go
 * through generateWithFallback(), which tries models in MODEL_CHAIN order and
 * degrades gracefully on rate-limit (429) or transient server errors (5xx).
 *
 * - FLASH_LITE: primary. Largest free-tier daily quota — the workhorse.
 * - FLASH:      fallback #1. Stronger reasoning, smaller free-tier quota.
 * - PRO:        fallback #2. Strongest reasoning, smallest free-tier quota.
 */
export const MODELS = {
  FLASH_LITE: "gemini-2.5-flash-lite",
  FLASH: "gemini-2.5-flash",
  PRO: "gemini-2.5-pro",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/** Ordered fallback chain. generateWithFallback() tries these in sequence. */
export const MODEL_CHAIN: ModelId[] = [
  MODELS.FLASH_LITE,
  MODELS.FLASH,
  MODELS.PRO,
];

let _client: GoogleGenAI | null = null;

/**
 * Lazy-initialized Gemini client. Throws when called without GEMINI_API_KEY,
 * not at module load time.
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

/** Shape of a single generateContent call's config, passed through unchanged. */
export interface GenerateConfig {
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: object;
  maxOutputTokens?: number;
  thinkingConfig?: { thinkingBudget: number };
}

export interface GenerateArgs {
  /** The `contents` array passed to generateContent (text parts, inlineData parts, etc). */
  contents: unknown;
  config: GenerateConfig;
}

export interface FallbackResult {
  /** The raw text returned by the model (JSON string when responseMimeType is JSON). */
  text: string;
  /** The model that actually served this request (may differ from primary if a fallback fired). */
  modelUsed: ModelId;
  /** finishReason from the served candidate, if available. */
  finishReason: string | undefined;
  /** Token usage from the served response. */
  inputTokens: number;
  outputTokens: number;
  /** Models that were tried and failed before the successful one (for logging/observability). */
  fallbacksTriggered: { model: ModelId; reason: string }[];
}

/**
 * Returns true if an error should trigger a fallback to the next model.
 * Retry on rate limits (429) and transient server errors (500, 503).
 * Do NOT retry on client errors (400), auth (401/403), or anything else —
 * those would fail identically on the next model.
 */
function isRetryableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { status?: number }).status;
  if (status === 429 || status === 500 || status === 503) return true;
  // Some errors surface the code in the message instead.
  const message = (error as { message?: string }).message ?? "";
  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(message)) return true;
  if (/\b50[03]\b|UNAVAILABLE|INTERNAL/i.test(message)) return true;
  return false;
}

/**
 * Calls Gemini's generateContent, trying each model in MODEL_CHAIN in order.
 * On a retryable error (rate limit / transient 5xx), logs it and tries the next
 * model. On any other error, throws immediately. If every model in the chain
 * fails, throws an aggregated error.
 *
 * This is the single entry point all BidLens agents use to call the model.
 */
export async function generateWithFallback(
  args: GenerateArgs
): Promise<FallbackResult> {
  const ai = getAI();
  const fallbacksTriggered: { model: ModelId; reason: string }[] = [];

  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: args.contents as never,
        config: args.config as never,
      });

      const rawText = response.text ?? "";
      const text = stripJsonFences(rawText);

      const usage = response.usageMetadata;
      return {
        text,
        modelUsed: model,
        finishReason: response.candidates?.[0]?.finishReason,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        fallbacksTriggered,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (isRetryableError(error) && i < MODEL_CHAIN.length - 1) {
        console.warn(
          `[generateWithFallback] ${model} failed (${message}). Falling back to ${MODEL_CHAIN[i + 1]}.`
        );
        fallbacksTriggered.push({ model, reason: message });
        continue;
      }
      // Non-retryable error, or we're out of models to try.
      if (i === MODEL_CHAIN.length - 1) {
        throw new Error(
          `All models in the fallback chain failed. Last error from ${model}: ${message}`
        );
      }
      throw error;
    }
  }

  // Unreachable, but satisfies the type checker.
  throw new Error(
    "generateWithFallback: model chain exhausted unexpectedly"
  );
}
