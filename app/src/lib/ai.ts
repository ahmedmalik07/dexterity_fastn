/**
 * AI provider.
 *
 * Anthropic is used when ANTHROPIC_API_KEY is set; otherwise Gemini. Both return JSON
 * that is validated with zod, and both get exactly one corrective retry before failing.
 */

import { z } from "zod";
import { optional } from "./env";
import { acrossModels } from "./models";

/** Models like to wrap JSON in ```json fences even when told not to. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) return fenced[1].trim();

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

async function askAnthropic(system: string, user: string, maxTokens: number): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: optional("ANTHROPIC_API_KEY") });

  const message = await client.messages.create({
    model: optional("ANTHROPIC_MODEL", "claude-sonnet-5"),
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });

  return message.content
    .filter((block): block is { type: "text"; text: string; citations: never } => block.type === "text")
    .map((block) => block.text)
    .join("");
}

async function callGemini(model: string, system: string, user: string, maxTokens: number) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": optional("GEMINI_API_KEY"),
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens, responseMimeType: "application/json" },
    }),
  });
}

/**
 * Spread a request across the model chain, so a burst of applicants during a demo does
 * not all land on one rate-limited model.
 */
async function askGemini(system: string, user: string, maxTokens: number): Promise<string> {
  return acrossModels<string>(async (model) => {
    const response = await callGemini(model, system, user, maxTokens);

    if (response.ok) {
      const payload = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = (payload.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("");
      return { ok: true, value: text };
    }

    return {
      ok: false,
      status: response.status,
      error: `Gemini ${response.status}: ${(await response.text()).slice(0, 200)}`,
    };
  });
}

function askOnce(system: string, user: string, maxTokens: number): Promise<string> {
  if (optional("ANTHROPIC_API_KEY")) return askAnthropic(system, user, maxTokens);
  if (optional("GEMINI_API_KEY")) return askGemini(system, user, maxTokens);
  throw new Error("No AI key configured: set ANTHROPIC_API_KEY or GEMINI_API_KEY");
}

/** Call the model and validate its JSON reply against `schema`. */
export async function askForJson<T>(
  system: string,
  user: string,
  schema: z.ZodType<T>,
  maxTokens = 2000,
): Promise<T> {
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? user
        : `${user}\n\nYour previous reply was invalid: ${lastError}\nReturn corrected JSON only.`;

    const raw = await askOnce(system, prompt, maxTokens);

    try {
      return schema.parse(JSON.parse(stripFences(raw)));
    } catch (error) {
      lastError = error instanceof Error ? error.message.slice(0, 600) : String(error);
    }
  }

  throw new Error(`AI returned invalid JSON after a retry: ${lastError}`);
}
