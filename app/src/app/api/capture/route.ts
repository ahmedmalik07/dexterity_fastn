/**
 * W6 — capture a candidate from a screenshot.
 *
 * The channels that matter most in Pakistani hiring (WhatsApp groups, Facebook groups,
 * DMs) have no API for anyone, Fastn included. This route takes what the recruiter can
 * see, reads the candidate out of it, and pushes them into the same Fastn pipeline as a
 * normal application. Called by the browser, or by the Dexterity desktop companion.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { readCandidateFromImage } from "@/lib/vision";
import { loadJob } from "@/lib/jobs";
import { channelStep } from "@/lib/fastn";
import { createCandidateRow } from "@/lib/notion";
import { sendEmail, slackAlert } from "@/lib/channels";
import { emailForStage } from "@/lib/emails";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

const Body = z.object({
  jobId: z.string().min(3).max(60),
  note: z.string().max(500).optional().default(""),
  /**
   * Set false from Dexterity to review before anything is sent.
   * Parsed by hand: z.coerce.boolean() turns the string "false" into true,
   * which would file a candidate the recruiter only wanted to preview.
   */
  commit: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(true)
    .transform((value) => (typeof value === "string" ? value.toLowerCase() !== "false" : value)),
});

export async function POST(request: Request) {
  if (!rateLimit(`capture:${clientIp(request)}`, 20)) {
    return NextResponse.json({ ok: false, error: "Too many captures, slow down." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid submission" }, { status: 400 });
  }

  const fields = Body.safeParse({
    jobId: form.get("jobId"),
    note: form.get("note") ?? "",
    commit: form.get("commit") ?? true,
  });
  if (!fields.success) {
    return NextResponse.json({ ok: false, error: fields.error.issues[0].message }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ ok: false, error: "Attach a screenshot" }, { status: 400 });
  }
  if (!ALLOWED.includes(image.type)) {
    return NextResponse.json({ ok: false, error: "Screenshot must be PNG, JPEG or WebP" }, { status: 400 });
  }
  if (image.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Screenshot must be under 8 MB" }, { status: 400 });
  }

  const { jobId, note, commit } = fields.data;
  const job = await loadJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "That job could not be found" }, { status: 404 });
  }

  let capture;
  try {
    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    capture = await readCandidateFromImage(base64, image.type, note);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the screenshot";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }

  if (!capture.found || !capture.name) {
    return NextResponse.json({
      ok: true,
      data: { added: false, capture, reason: "No candidate was visible in that screenshot" },
    });
  }

  // Dry run: let the recruiter confirm before anything leaves the building.
  if (!commit) {
    return NextResponse.json({ ok: true, data: { added: false, capture, reason: "preview" } });
  }

  const notion = await channelStep("notion", () =>
    createCandidateRow({
      name: capture.name,
      email: capture.email,
      phone: capture.phone,
      jobId,
      source: capture.channel,
      score: 0,
      verdict: "Maybe",
      summary: capture.summary || "Captured from screen, CV not yet received",
      strengths: capture.messageText.slice(0, 400),
      gaps: note ? `Recruiter note: ${note}` : "Captured from a screenshot, no CV parsed yet",
      cvUrl: "",
      linkedinProfile: capture.linkedin,
    }),
  );

  // If we got an email address, invite them to complete a proper application.
  let emailed = false;
  if (capture.email) {
    const template = emailForStage("Applied", capture.name, job.title);
    const withLink = template && {
      subject: template.subject,
      body: `${template.body}\n\nIf you have not sent your CV yet, you can attach it here:\n${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/apply/${jobId}?src=${capture.channel}`,
    };
    if (withLink) {
      const mail = await channelStep("email", () => sendEmail(capture.email, withLink.subject, withLink.body));
      emailed = mail.ok;
    }
  }

  await channelStep("slack", () =>
    slackAlert(
      [
        `*Candidate captured from ${capture.channel}* for ${job.title}`,
        `${capture.name}${capture.email ? ` — ${capture.email}` : ""}`,
        capture.summary,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  );

  return NextResponse.json({
    ok: true,
    data: { added: notion.ok, emailed, capture, error: notion.error },
  });
}
