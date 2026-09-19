/**
 * Read a candidate off a screenshot.
 *
 * This is the part Fastn's connector catalogue cannot reach: WhatsApp groups, Facebook
 * groups and DMs have no posting or reading API at all. A recruiter looking at one of
 * those conversations can capture it, and we pull the candidate out of the pixels and
 * push them into the same pipeline through Fastn.
 */

import { z } from "zod";
import { optional } from "./env";
import { acrossModels } from "./models";

export const CaptureSchema = z.object({
  found: z.boolean(),
  name: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  linkedin: z.string().default(""),
  channel: z.enum(["whatsapp", "facebook", "linkedin", "x", "discord", "direct"]).default("direct"),
  messageText: z.string().default(""),
  summary: z.string().default(""),
  confidence: z.enum(["high", "medium", "low"]).default("low"),
});
export type Capture = z.infer<typeof CaptureSchema>;

export const CAPTURE_PROMPT = `You extract a job candidate from a screenshot of a messaging app, social feed or email.

Rules:
- Only report what is actually visible. Never invent a name, email or phone number.
- If no candidate is present, set "found" to false and leave the fields empty.
- "channel" is the app the screenshot is from, judged from its interface.
- "messageText" is the candidate's own message, copied as written.
- "summary" is one short line a recruiter reads on a card, max 20 words.
- "confidence" is low when the details are partly hidden, cut off or ambiguous.

Respond with JSON only:
{
  "found": boolean,
  "name": string,
  "email": string,
  "phone": string,
  "linkedin": string,
  "channel": "whatsapp" | "facebook" | "linkedin" | "x" | "discord" | "direct",
  "messageText": string,
  "summary": string,
  "confidence": "high" | "medium" | "low"
}`;

function stripFences(text: string): string {
  const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  return first !== -1 && last > first ? text.slice(first, last + 1) : text.trim();
}

/** Ask a vision model about an image and validate its JSON answer. */
export async function askFromImage<T>(
  imageBase64: string,
  mimeType: string,
  systemPrompt: string,
  note: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const userText = note ? `The user added this note: ${note}` : "Answer from this screenshot.";

  return acrossModels<T>(async (model) => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": optional("GEMINI_API_KEY"),
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: "user",
              parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: userText }],
            },
          ],
          generationConfig: { maxOutputTokens: 1200, responseMimeType: "application/json" },
        }),
      },
    );

    if (response.ok) {
      const payload = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const raw = (payload.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("");
      return { ok: true, value: schema.parse(JSON.parse(stripFences(raw))) };
    }

    return {
      ok: false,
      status: response.status,
      error: `Could not read the screenshot (${response.status})`,
    };
  });
}

/** Pull a candidate out of a screenshot of a chat, feed or inbox. */
export function readCandidateFromImage(
  imageBase64: string,
  mimeType: string,
  note: string,
): Promise<Capture> {
  return askFromImage(imageBase64, mimeType, CAPTURE_PROMPT, note, CaptureSchema);
}
