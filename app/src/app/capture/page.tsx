"use client";

import { useEffect, useState } from "react";
import { TopBar, Pill } from "@/components/Shell";

type Capture = {
  found: boolean;
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  channel: string;
  messageText: string;
  summary: string;
  confidence: "high" | "medium" | "low";
};

type Result = { added: boolean; emailed?: boolean; capture: Capture; reason?: string; error?: string };

export default function CapturePage() {
  const [jobId, setJobId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  // Paste a screenshot straight from the clipboard — how a recruiter actually works.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const item = [...(event.clipboardData?.items ?? [])].find((entry) =>
        entry.type.startsWith("image/"),
      );
      const pasted = item?.getAsFile();
      if (pasted) choose(pasted);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function choose(next: File) {
    setFile(next);
    setResult(null);
    setError("");
    setPreview(URL.createObjectURL(next));
  }

  async function send(commit: boolean) {
    if (!file || !jobId) return;
    setBusy(true);
    setError("");

    const form = new FormData();
    form.set("image", file);
    form.set("jobId", jobId);
    form.set("note", note);
    form.set("commit", String(commit));

    try {
      const response = await fetch("/api/capture", { method: "POST", body: form });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error);
      setResult(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Capture failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar right={<span className="hidden text-sm sm:inline">Capture</span>} />

      <main className="mx-auto max-w-5xl px-5 py-10">
        <p className="eyebrow">The channels with no API</p>
        <h1 className="mt-2 text-3xl font-semibold">Capture a candidate from your screen</h1>
        <p className="mt-2 max-w-2xl text-ink-600">
          WhatsApp groups, Facebook groups and DMs have no API for anyone. Screenshot the message,
          drop it here, and the candidate joins the same pipeline as every other applicant.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="card p-6">
            <label className="block text-sm font-medium text-ink-800">Job</label>
            <input
              value={jobId}
              onChange={(event) => setJobId(event.target.value.trim())}
              placeholder="junior-react-isb-y89"
              className="field mt-1.5 font-mono text-sm"
            />

            <label className="mt-4 block text-sm font-medium text-ink-800">
              Note <span className="font-normal text-ink-400">· optional</span>
            </label>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Met at the Islamabad React meetup"
              className="field mt-1.5"
            />

            <label
              htmlFor="shot"
              className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink-300 bg-ink-50 p-4 text-center hover:border-accent-500"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Screenshot to be read" className="max-h-52 rounded-lg" />
              ) : (
                <>
                  <span className="text-sm font-medium text-ink-700">Drop or choose a screenshot</span>
                  <span className="text-xs text-ink-500">or just press Ctrl+V anywhere on this page</span>
                </>
              )}
            </label>
            <input
              id="shot"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => {
                const picked = event.target.files?.[0];
                if (picked) choose(picked);
              }}
            />

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => send(false)}
                disabled={busy || !file || !jobId}
                className="btn btn-quiet flex-1"
              >
                {busy ? "Reading…" : "Preview"}
              </button>
              <button
                onClick={() => send(true)}
                disabled={busy || !file || !jobId}
                className="btn btn-accent flex-1"
              >
                Add to pipeline
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-bad-700/20 bg-bad-50 p-3 text-sm text-bad-700">
                {error}
              </p>
            )}
          </section>

          <section className="card p-6">
            <span className="eyebrow">What we read</span>

            {!result && (
              <p className="mt-3 text-sm text-ink-500">
                Nothing yet. Preview first if you want to check the details before anything is sent.
              </p>
            )}

            {result && !result.capture.found && (
              <p className="mt-3 text-sm text-ink-600">
                {result.reason ?? "No candidate was visible in that screenshot."}
              </p>
            )}

            {result?.capture.found && (
              <div className="rise mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{result.capture.name}</span>
                  <Pill tone="accent">{result.capture.channel}</Pill>
                  <Pill tone={result.capture.confidence === "high" ? "good" : "warn"}>
                    {result.capture.confidence} confidence
                  </Pill>
                </div>

                <dl className="mt-4 divide-y divide-ink-100 border-y border-ink-100 text-sm">
                  <Row label="Email" value={result.capture.email} />
                  <Row label="Phone" value={result.capture.phone} />
                  <Row label="LinkedIn" value={result.capture.linkedin} />
                </dl>

                {result.capture.messageText && (
                  <blockquote className="mt-4 rounded-lg bg-ink-50 p-3 text-sm leading-relaxed text-ink-700">
                    {result.capture.messageText}
                  </blockquote>
                )}

                <p className="mt-3 text-sm text-ink-600">{result.capture.summary}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {result.added ? (
                    <Pill tone="good">added to the hiring board</Pill>
                  ) : result.reason === "preview" ? (
                    <Pill>preview only, nothing sent</Pill>
                  ) : (
                    <Pill tone="warn">{result.error ?? "not added"}</Pill>
                  )}
                  {result.emailed && <Pill tone="good">confirmation emailed</Pill>}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-ink-500">{label}</dt>
      <dd className={value ? "font-medium text-ink-900" : "text-ink-400"}>{value || "not visible"}</dd>
    </div>
  );
}
