import { GoogleGenAI } from "@google/genai";

/**
 * Model IDs used throughout BidLens.
 *
 * BidLens's agent layer is provider-agnostic and model-resilient. Calls go
 * through generateWithFallback(taskType, args), which routes through a per-task
 * model chain (see MODEL_CHAINS) and degrades gracefully on rate-limit (429)
 * or transient server errors (5xx).
 */
export const MODELS = {
  FLASH_LITE: "gemini-2.5-flash-lite",
  FLASH: "gemini-2.5-flash",
  PRO: "gemini-2.5-pro",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/**
 * Task-aware model routing.
 *
 * Different agent types have different cognitive demands and call volumes, so
 * they route through different model chains. Two principles:
 *
 *  1. Capability matching — extraction gets the light model, synthesis gets
 *     the strong model, judgment sits between.
 *  2. Quota-aware ordering — high-volume task types lead with the high-quota
 *     model (flash-lite, ~1,500 req/day free tier); the low-volume synthesis
 *     task leads with the low-quota model (pro, ~50 req/day). The free-tier
 *     rate-limit budget is respected by design.
 *
 * Every chain has full fallback coverage — a rate limit or transient outage
 * on one model degrades gracefully to the next, never an outage.
 */
export type TaskType = "ingestion" | "evaluation" | "synthesis" | "qa";

export const MODEL_CHAINS: Record<TaskType, ModelId[]> = {
  // Faithful extraction against an explicit schema. Low reasoning demand,
  // highest call volume — lead with the cheapest capable, highest-quota model.
  ingestion: [MODELS.FLASH_LITE, MODELS.FLASH, MODELS.PRO],
  // Scoring nuanced trade-offs against a rubric. Judgment task — lead with the
  // stronger model; flash-lite is an acceptable degradation, pro the safety net.
  evaluation: [MODELS.FLASH, MODELS.FLASH_LITE, MODELS.PRO],
  // Weighing vendors against each other, surfacing non-obvious risks, writing a
  // defensible memo. Highest reasoning demand, lowest call volume (~2 calls) —
  // worth the strongest model; pro's small quota is fine at this volume.
  synthesis: [MODELS.PRO, MODELS.FLASH, MODELS.FLASH_LITE],
  // Grounded retrieval, interactive, latency-sensitive — lead with the fast
  // high-quota model.
  qa: [MODELS.FLASH_LITE, MODELS.FLASH, MODELS.PRO],
};

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
  /** The model that actually served this request (may differ from the chain's primary if a fallback fired). */
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
  const message = (error as { message?: string }).message ?? "";
  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(message)) return true;
  if (/\b50[03]\b|UNAVAILABLE|INTERNAL/i.test(message)) return true;
  return false;
}

/**
 * Calls Gemini's generateContent, routing through the model chain for the
 * given task type. Tries each model in order; on a retryable error (rate
 * limit / transient 5xx), logs it and tries the next. On any other error,
 * throws immediately. If every model in the chain fails, throws an aggregated
 * error.
 *
 * This is the single entry point all BidLens agents use to call the model.
 */
export async function generateWithFallback(
  taskType: TaskType,
  args: GenerateArgs
): Promise<FallbackResult> {
  const ai = getAI();
  const chain = MODEL_CHAINS[taskType];
  const fallbacksTriggered: { model: ModelId; reason: string }[] = [];

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
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
      if (isRetryableError(error) && i < chain.length - 1) {
        console.warn(
          `[generateWithFallback:${taskType}] ${model} failed (${message}). ` +
            `Falling back to ${chain[i + 1]}.`
        );
        fallbacksTriggered.push({ model, reason: message });
        continue;
      }
      if (i === chain.length - 1) {
        throw new Error(
          `All models in the ${taskType} chain failed. Last error from ${model}: ${message}`
        );
      }
      throw error;
    }
  }

  // Unreachable, but satisfies the type checker.
  throw new Error(
    `generateWithFallback: ${taskType} chain exhausted unexpectedly`
  );
}
