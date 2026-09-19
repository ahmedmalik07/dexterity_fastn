"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar, Pill } from "@/components/Shell";
import type { Job, Platform } from "@/lib/schemas";

type ChannelResult = { channel: string; ok: boolean; error?: string; manual?: boolean };

type PublishData = {
  jobId: string;
  applyBaseUrl: string;
  variants: Record<Platform, string>;
  linkedinUrl?: string;
  xUrl?: string;
  notionJobUrl?: string;
  channels: ChannelResult[];
};

const TABS: { key: Platform; label: string; limit?: number; api: boolean }[] = [
  { key: "linkedin", label: "LinkedIn", api: true },
  { key: "x", label: "X", limit: 280, api: true },
  { key: "facebook", label: "Facebook", api: false },
  { key: "whatsapp", label: "WhatsApp", api: false },
  { key: "discord", label: "Discord", api: false },
];

const EXAMPLES = [
  "Junior React dev, Islamabad, onsite, up to 80k",
  "Mid-level Laravel developer, Lahore, hybrid, 150k",
  "Social media intern, Karachi, remote, 35k",
];

export default function ComposePage() {
  const [oneLiner, setOneLiner] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [variants, setVariants] = useState<Record<Platform, string> | null>(null);
  const [tab, setTab] = useState<Platform>("linkedin");
  const [published, setPublished] = useState<PublishData | null>(null);

  async function generate() {
    setLoading(true);
    setError("");
    setPublished(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oneLiner }),
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error);

      setJobId(payload.data.jobId);
      setJob(payload.data.job);
      setVariants(payload.data.variants);
      setTab("linkedin");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function publish() {
    if (!job || !variants) return;
    setPublishing(true);
    setError("");
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId, job, variants, oneLiner }),
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error);
      setPublished(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <TopBar right={<span className="hidden text-sm sm:inline">Compose</span>} />

      <main className="mx-auto max-w-6xl px-5 py-10">
        {/* Step 1 — the one line */}
        <section className="card p-6 sm:p-7">
          <p className="eyebrow">Step one</p>
          <h1 className="mt-2 text-2xl font-semibold">Describe the role in one line</h1>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={oneLiner}
              onChange={(event) => setOneLiner(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && oneLiner.trim().length >= 8 && !loading) generate();
              }}
              placeholder="Junior React dev, Islamabad, onsite, up to 80k"
              className="field sm:flex-1"
            />
            <button
              onClick={generate}
              disabled={loading || oneLiner.trim().length < 8}
              className="btn btn-primary sm:w-40"
            >
              {loading ? "Writing…" : "Generate"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-500">Try:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => setOneLiner(example)}
                className="rounded-full border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:border-ink-300"
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <p className="mt-4 rounded-lg border border-bad-700/20 bg-bad-50 p-3 text-sm text-bad-700">
            {error}
          </p>
        )}

        {job && variants && (
          <section className="rise mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            {/* The job itself */}
            <div className="card p-6">
              <p className="eyebrow">Step two · the role</p>
              <h2 className="mt-2 text-xl font-semibold">{job.title}</h2>

              <div className="mt-2 flex flex-wrap gap-2">
                <Pill>{job.location}</Pill>
                <Pill>{job.workMode}</Pill>
                <Pill tone="accent">{job.salaryRange}</Pill>
              </div>

              <label className="eyebrow mt-6 block">Job description</label>
              <textarea
                value={job.jdText}
                onChange={(event) => setJob({ ...job, jdText: event.target.value })}
                rows={14}
                className="field mt-2 resize-y font-mono text-[13px] leading-relaxed"
              />

              <div className="mt-4">
                <span className="eyebrow">Must-haves</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {job.mustHaves.map((item) => (
                    <Pill key={item}>{item}</Pill>
                  ))}
                </div>
              </div>
            </div>

            {/* Per-platform versions */}
            <div className="card p-6">
              <p className="eyebrow">Step three · each channel</p>
              <h2 className="mt-2 text-xl font-semibold">One post, written five ways</h2>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {TABS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      tab === item.key
                        ? "bg-ink-900 text-white"
                        : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <textarea
                value={variants[tab]}
                onChange={(event) => setVariants({ ...variants, [tab]: event.target.value })}
                rows={13}
                className="field mt-4 resize-y text-[14px] leading-relaxed"
              />

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={overLimit(variants[tab], tab) ? "text-bad-700" : "text-ink-500"}>
                  {variants[tab].length}
                  {TABS.find((item) => item.key === tab)?.limit
                    ? ` / ${TABS.find((item) => item.key === tab)!.limit}`
                    : " characters"}
                </span>

                {variants[tab].includes("{{APPLY_LINK}}") ? (
                  <Pill tone="good">tracked apply link ready</Pill>
                ) : (
                  <Pill tone="warn">apply link placeholder missing</Pill>
                )}
              </div>

              <button
                onClick={publish}
                disabled={publishing || !!published}
                className="btn btn-accent mt-5 w-full"
              >
                {publishing ? "Publishing through Fastn…" : published ? "Published" : "Publish"}
              </button>
              <p className="mt-2 text-center text-xs text-ink-500">
                Writes the hiring board and posts to every connected channel.
              </p>
            </div>
          </section>
        )}

        {published && <PublishedPanel data={published} />}
      </main>
    </>
  );
}

function overLimit(value: string, platform: Platform): boolean {
  return platform === "x" && value.length > 280;
}

function PublishedPanel({ data }: { data: PublishData }) {
  const directLink = `${data.applyBaseUrl}?src=direct`;
  const posted = new Set(data.channels.filter((channel) => channel.ok).map((channel) => channel.channel));
  const copyOnly = (["linkedin", "x", "facebook", "whatsapp", "discord"] as Platform[]).filter(
    (platform) => !posted.has(platform),
  );

  return (
    <section className="rise mt-6 card overflow-hidden">
      <div className="border-b border-ink-200 bg-ink-50 px-6 py-4">
        <p className="eyebrow">Step four · live</p>
        <h2 className="mt-1 text-xl font-semibold">Your job is collecting applications</h2>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        {/* QR — the demo centrepiece */}
        <div className="flex flex-col items-center">
          <div className="rounded-xl border border-ink-200 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr?text=${encodeURIComponent(directLink)}`}
              alt="QR code linking to the application page"
              className="h-44 w-44"
            />
          </div>
          <p className="mt-2 text-xs text-ink-500">Scan to apply</p>
          <a
            href={directLink}
            target="_blank"
            rel="noreferrer"
            className="mt-1 max-w-44 truncate text-xs text-accent-600 underline"
          >
            {directLink.replace(/^https?:\/\//, "")}
          </a>
        </div>

        <div className="min-w-0">
          <span className="eyebrow">Channels</span>
          <ul className="mt-2 divide-y divide-ink-100 border-y border-ink-100">
            {data.channels.map((channel) => (
              <li key={channel.channel} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm font-medium capitalize">{channel.channel}</span>
                {channel.ok ? (
                  <Pill tone="good">posted through Fastn</Pill>
                ) : channel.manual ? (
                  <Pill>copy &amp; paste below</Pill>
                ) : (
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs text-ink-500" title={channel.error}>
                      {channel.error}
                    </span>
                    <Pill tone="warn">not connected</Pill>
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {data.notionJobUrl && (
              <a className="text-accent-600 underline" href={data.notionJobUrl} target="_blank" rel="noreferrer">
                Open hiring board
              </a>
            )}
            {data.linkedinUrl && (
              <a className="text-accent-600 underline" href={data.linkedinUrl} target="_blank" rel="noreferrer">
                LinkedIn post
              </a>
            )}
            {data.xUrl && (
              <a className="text-accent-600 underline" href={data.xUrl} target="_blank" rel="noreferrer">
                X post
              </a>
            )}
            <Link className="text-accent-600 underline" href={`/stats/${data.jobId}`}>
              Channel performance
            </Link>
          </div>

          <div className="mt-6">
            <span className="eyebrow">Post these yourself — one tap each</span>
            <p className="mt-1 text-xs text-ink-500">
              Meta closed the Facebook Groups API and WhatsApp has none for groups, so no tool can
              post there. The text is written and the apply link is already tagged to the right
              source, so the pipeline still knows where each candidate came from.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {copyOnly.map((platform) => (
                <CopyBlock key={platform} platform={platform} text={data.variants[platform]} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CopyBlock({ platform, text }: { platform: Platform; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="rounded-lg border border-ink-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium capitalize">{platform}</span>
        <div className="flex gap-1.5">
          {platform === "whatsapp" && (
            <a
              className="btn btn-quiet !px-2 !py-1 !text-[11px]"
              href={`https://wa.me/?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
            >
              Share
            </a>
          )}
          <button onClick={copy} className="btn btn-primary !px-2.5 !py-1 !text-[11px]">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-500">
        {text}
      </p>
    </div>
  );
}
