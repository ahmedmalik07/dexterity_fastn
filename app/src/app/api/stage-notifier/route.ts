/**
 * W3 — stage notifier, run by the Vercel cron job.
 *
 * The logic lives in lib/stages.ts because the pipeline page runs the same thing while
 * an HR person is watching it. This route is the scheduled entry point and is protected
 * by CRON_SECRET, since it sends real email.
 */

import { NextResponse } from "next/server";
import { runStageNotifier } from "@/lib/stages";
import { optional } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorised(request: Request): boolean {
  const secret = optional("CRON_SECRET");
  if (!secret) return false;
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
  }

  const result = await runStageNotifier();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, data: { checked: result.checked, sent: result.sent } });
}
