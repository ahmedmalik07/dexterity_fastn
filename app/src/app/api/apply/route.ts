import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { extractText, getDocumentProxy } from "unpdf";
import { ApplyFields, ScoreSchema, type Score } from "@/lib/schemas";
import { askForJson } from "@/lib/ai";
import { PROMPT_C } from "@/lib/prompts";
import { loadJob } from "@/lib/jobs";
import { channelStep } from "@/lib/fastn";
import { createCandidateRow } from "@/lib/notion";
import { sendEmail, slackAlert } from "@/lib/channels";
import { emailForStage } from "@/lib/emails";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

/** A CV we cannot read still becomes a card — flagged for a human, never a crash. */
const UNREADABLE: Score = {
  score: 0,
  verdict: "Maybe",
  mustHaveChecks: [],
  strengths: "",
  gaps: "",
  summary: "CV could not be read, review manually",
};

export async function POST(request: Request) {
  if (!rateLimit(`apply:${clientIp(request)}`)) {
    return NextResponse.json(
      { ok: false, error: "Too many applications from this device. Please try again later." },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form submission" }, { status: 400 });
  }

  const fields = ApplyFields.safeParse({
    jobId: form.get("jobId"),
    name: form.get("name"),
    email: form.get("email"),
    phone: form.get("phone"),
    linkedin: form.get("linkedin") ?? "",
    src: form.get("src") ?? "direct",
    consent: form.get("consent"),
  });
  if (!fields.success) {
    return NextResponse.json({ ok: false, error: fields.error.issues[0].message }, { status: 400 });
  }

  const file = form.get("cv");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "Please attach your CV as a PDF" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ ok: false, error: "Your CV must be a PDF file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Your CV must be smaller than 5 MB" }, { status: 400 });
  }

  const { jobId, name, email, phone, linkedin, src } = fields.data;
  const job = await loadJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "This job posting could not be found" }, { status: 404 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    return NextResponse.json({ ok: false, error: "This file is not a valid PDF" }, { status: 400 });
  }

  // 1. Store the CV.
  let cvUrl = "";
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(`cvs/${jobId}/${Date.now()}-${file.name}`, Buffer.from(bytes), {
        access: "public",
        contentType: "application/pdf",
      });
      cvUrl = blob.url;
    } catch {
      return NextResponse.json({ ok: false, error: "Your CV could not be stored. Please try again." }, { status: 503 });
    }
  } else {
    return NextResponse.json({ ok: false, error: "CV uploads are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }

  // 2. Read the PDF. Scanned, image-only CVs land here with almost no text.
  let cvText = "";
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    cvText = (Array.isArray(text) ? text.join("\n") : text).trim();
  } catch {
    cvText = "";
  }

  // 3. Score it, unless there is nothing to score.
  let ai = UNREADABLE;
  if (cvText.length >= 200) {
    try {
      ai = await askForJson(
        PROMPT_C,
        [
          `Job title: ${job.title}`,
          `Must-haves: ${job.mustHaves.join(", ")}`,
          `Nice-to-haves: ${job.niceToHaves.join(", ")}`,
          "",
          "Job description:",
          job.jdText,
          "",
          "CV text:",
          cvText.slice(0, 12000),
        ].join("\n"),
        ScoreSchema,
        2000,
      );
    } catch {
      ai = { ...UNREADABLE, summary: "Scoring failed, review manually" };
    }
  }

  // 4. Everything outbound goes through Fastn.
  const notion = await channelStep("notion", () =>
    createCandidateRow({
      name,
      email,
      phone,
      jobId,
      source: src,
      score: ai.score,
      verdict: ai.verdict,
      summary: ai.summary,
      strengths: ai.strengths,
      gaps: ai.gaps,
      cvUrl,
      linkedinProfile: linkedin ?? "",
    }),
  );

  if (!notion.ok) {
    return NextResponse.json({ ok: false, error: "Your application could not be saved. Please try again." }, { status: 502 });
  }

  const received = emailForStage("Applied", name, job.title);
  const mail = await channelStep("email", () =>
    sendEmail(email, received!.subject, received!.body),
  );

  if (ai.verdict === "Strong") {
    await channelStep("slack", () =>
      slackAlert(
        [
          `*Strong candidate* for ${job.title}`,
          `${name} — ${ai.score}/100 (via ${src})`,
          ai.summary,
          cvUrl ? `CV: ${cvUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    );
  }

  // The candidate never sees the score.
  return NextResponse.json({
    ok: true,
    data: { received: true, notionOk: notion.ok, emailOk: mail.ok },
  });
}
