/**
 * Draft a job one-liner from whatever is on the user's screen.
 *
 * The point of the assistant: you are already looking at the thing (a requirement doc,
 * a Slack thread, a spreadsheet row). You should not have to screenshot it into a chat
 * bot and retype the role. Dexterity sends the screen here and gets the one line back.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { askFromImage } from "@/lib/vision";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const DraftSchema = z.object({
  found: z.boolean(),
  oneLiner: z.string().default(""),
  reason: z.string().default(""),
});

const PROMPT = `You are looking at a screenshot from someone's computer. They want to hire for a role.

Write the single line they would type into a job posting tool, in this shape:
"<seniority> <role>, <city>, <onsite|hybrid|remote>, <salary>"
for example "Junior React dev, Islamabad, onsite, up to 80k".

Rules:
- Use only details actually visible. Leave out anything that is not there rather than inventing it.
- If the screen has nothing to do with hiring, set found to false and explain briefly in reason.

Respond with JSON only:
{ "found": boolean, "oneLiner": string, "reason": string }`;

export async function POST(request: Request) {
  if (!rateLimit(`screen:${clientIp(request)}`, 20)) {
    return NextResponse.json({ ok: false, error: "Too many requests, slow down." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid submission" }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ ok: false, error: "Attach a screenshot" }, { status: 400 });
  }
  if (image.size > 8 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "Screenshot is too large" }, { status: 400 });
  }

  try {
    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const draft = await askFromImage(
      base64,
      image.type || "image/png",
      PROMPT,
      String(form.get("note") ?? ""),
      DraftSchema,
    );
    return NextResponse.json({ ok: true, data: draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the screen";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
