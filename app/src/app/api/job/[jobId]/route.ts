import { NextResponse } from "next/server";
import { loadJob } from "@/lib/jobs";

export const runtime = "nodejs";

/** Public job fields for the apply page. Never exposes scoring internals. */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await loadJob(jobId);

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: job });
}
