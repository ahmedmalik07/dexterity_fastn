import { NextResponse } from "next/server";
import { PublishBody } from "@/lib/schemas";
import { withTrackedLinks } from "@/lib/tracking";
import { env } from "@/lib/env";
import { saveJob } from "@/lib/jobs";
import { channelStep, type ChannelResult } from "@/lib/fastn";
import { createJobRow } from "@/lib/notion";
import { linkedInPostUrl, postToLinkedIn, postToX, slackAlert, xPostUrl } from "@/lib/channels";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = PublishBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { jobId, job, variants, oneLiner } = parsed.data;
  const applyBaseUrl = `${env.baseUrl()}/apply/${jobId}`;
  const finalVariants = withTrackedLinks(variants, applyBaseUrl);

  // The apply page reads this, so write it before anything is published anywhere.
  await saveJob({
    jobId,
    title: job.title,
    location: job.location,
    workMode: job.workMode,
    salaryRange: job.salaryRange,
    summary: job.summary,
    jdText: job.jdText,
    responsibilities: job.responsibilities,
    mustHaves: job.mustHaves,
    niceToHaves: job.niceToHaves,
  });

  /**
   * A channel with no credentials is not a failure — it is a channel the recruiter
   * posts by hand. Only attempt the ones that are actually wired up, so nothing
   * "fails" on stage for a reason we already know about.
   */
  const linkedinReady = Boolean(process.env.FASTN_CONN_LINKEDIN && process.env.LINKEDIN_AUTHOR_URN);
  const xReady = Boolean(process.env.FASTN_CONN_X);

  // Each channel publishes independently — one failure must not stop the others.
  const [linkedin, x] = await Promise.all([
    linkedinReady
      ? channelStep("linkedin", () => postToLinkedIn(finalVariants.linkedin))
      : Promise.resolve({ channel: "linkedin", ok: false, manual: true } as const),
    xReady
      ? channelStep("x", () => postToX(finalVariants.x))
      : Promise.resolve({ channel: "x", ok: false, manual: true } as const),
  ]);

  const linkedinUrl = linkedInPostUrl(("data" in linkedin ? (linkedin.data as { id?: string }) : undefined)?.id);
  const postedXId = ("data" in x ? (x.data as { data?: { id?: string } }) : undefined)?.data?.id;
  const xUrl = xPostUrl(postedXId);

  // Notion row is created last so the post URLs land in it at creation time.
  const notion = await channelStep("notion", () =>
    createJobRow({
      jobId,
      title: job.title,
      oneLiner: oneLiner || job.summary,
      location: job.location,
      workMode: job.workMode,
      salaryRange: job.salaryRange,
      jdText: job.jdText,
      mustHaves: job.mustHaves,
      niceToHaves: job.niceToHaves,
      applyUrl: applyBaseUrl,
      linkedinPostUrl: linkedinUrl,
      xPostUrl: xUrl,
      status: "Live",
    }),
  );

  if (!notion.ok) {
    return NextResponse.json({ ok: false, error: "The hiring board could not save this role. Please retry after checking the Fastn connection." }, { status: 502 });
  }

  const slack = await channelStep("slack", () =>
    slackAlert(
      [
        `*New job is live: ${job.title}*`,
        `${job.location} · ${job.workMode} · ${job.salaryRange}`,
        `Apply: ${applyBaseUrl}?src=slack`,
      ].join("\n"),
    ),
  );

  const channels: ChannelResult[] = [linkedin, x, notion, slack].map((step) => ({
    channel: step.channel,
    ok: step.ok,
    error: "error" in step ? step.error : undefined,
    // `manual` means "no connector for this, the recruiter pastes it" — not a failure.
    manual: "manual" in step ? step.manual : false,
  }));

  return NextResponse.json({
    ok: true,
    data: {
      jobId,
      applyBaseUrl,
      variants: finalVariants,
      linkedinUrl,
      xUrl,
      notionJobUrl: (notion.data as { url?: string } | undefined)?.url,
      channels,
    },
  });
}
