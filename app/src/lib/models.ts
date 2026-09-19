/**
 * Which Gemini models to try, and in what order.
 *
 * The free tier limits requests *per minute per model*. During a demo several people
 * apply at once, and a single model rate-limits immediately — which is how a CV ends up
 * scored "Scoring failed, review manually". Each model has its own budget, so spreading
 * a burst across several of them is what keeps the queue moving.
 */

import { optional } from "./env";

const DEFAULT_CHAIN = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
].join(",");

export function modelChain(): string[] {
  return optional("GEMINI_MODEL", DEFAULT_CHAIN)
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

/** Worth trying a different model for: rate limit, missing model, or overloaded. */
export function shouldFallThrough(status: number): boolean {
  return status === 429 || status === 404 || status === 503;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Walk the chain; if every model was rate-limited, wait briefly and walk it once more.
 * A per-minute window often frees up within a few seconds when the burst is small.
 */
export async function acrossModels<T>(
  attempt: (model: string) => Promise<{ ok: true; value: T } | { ok: false; status: number; error: string }>,
): Promise<T> {
  const models = modelChain();
  let lastError = "no model was tried";

  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) await sleep(4000);

    for (const model of models) {
      const result = await attempt(model);
      if (result.ok) return result.value;

      lastError = result.error;
      if (!shouldFallThrough(result.status)) throw new Error(lastError);
    }
  }

  throw new Error(lastError);
}
