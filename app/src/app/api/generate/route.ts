import { NextResponse } from "next/server";
import { askForJson } from "@/lib/ai";
import { PROMPT_A, PROMPT_B } from "@/lib/prompts";
import { GenerateBody, JobSchema, VariantsSchema } from "@/lib/schemas";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = GenerateBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { oneLiner } = parsed.data;

  try {
    const job = await askForJson(PROMPT_A, `One-line role description:\n${oneLiner}`, JobSchema, 2500);

    const variants = await askForJson(
      PROMPT_B,
      [
        `Job title: ${job.title}`,
        `Location: ${job.location} (${job.workMode})`,
        `Salary: ${job.salaryRange}`,
        `Must-haves: ${job.mustHaves.join(", ")}`,
        "",
        "Full JD:",
        job.jdText,
      ].join("\n"),
      VariantsSchema,
      2500,
    );

    return NextResponse.json({
      ok: true,
      data: { jobId: slugify(job.title, job.location), job, variants, oneLiner },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
