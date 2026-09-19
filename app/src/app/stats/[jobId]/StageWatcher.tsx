"use client";

import { useEffect, useRef, useState } from "react";
import { Pill } from "@/components/Shell";
import { checkStages } from "./actions";
import type { StageEmail } from "@/lib/stages";

const INTERVAL_MS = 12_000;

/**
 * Watches the hiring board while HR has this page open.
 *
 * Move a card on the Notion board and the candidate hears about it within a few seconds.
 * The Vercel free plan only permits a daily cron, so this is what keeps the loop live —
 * and it is the honest version of the feature: it only runs while someone is watching.
 */
export default function StageWatcher({ jobId }: { jobId: string }) {
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<StageEmail[]>([]);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const running = useRef(false);

  async function runOnce() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const result = await checkStages(jobId);
      if (!result.ok) {
        setError(result.error ?? "Could not read the board");
      } else {
        setError("");
        if (result.sent.length) setSent((previous) => [...result.sent, ...previous].slice(0, 12));
      }
      setLastRun(new Date());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!watching) return;
    runOnce();
    const timer = setInterval(runOnce, INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, jobId]);

  return (
    <section className="card mt-8 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Stage emails</h2>
          <p className="mt-1 text-sm text-ink-600">
            Move a candidate on the Notion board and they hear about it. Each stage is sent
            once, never twice.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={runOnce} disabled={busy} className="btn btn-quiet">
            {busy ? "Checking…" : "Check now"}
          </button>
          <button
            onClick={() => setWatching((value) => !value)}
            className={watching ? "btn btn-quiet" : "btn btn-accent"}
          >
            {watching ? "Stop watching" : "Watch the board"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-500">
        {watching ? (
          <Pill tone="good">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good-600 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-good-600" />
            </span>
            watching every {INTERVAL_MS / 1000}s
          </Pill>
        ) : (
          <Pill>not watching</Pill>
        )}
        {lastRun && <span>last checked {lastRun.toLocaleTimeString()}</span>}
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-bad-700/20 bg-bad-50 p-3 text-sm text-bad-700">
          {error}
        </p>
      )}

      {sent.length > 0 && (
        <ul className="mt-4 divide-y divide-ink-100 border-t border-ink-100">
          {sent.map((email, index) => (
            <li key={`${email.name}-${email.stage}-${index}`} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm">
                <strong className="font-medium">{email.name}</strong>
                <span className="text-ink-500"> · {email.stage}</span>
              </span>
              {email.ok ? (
                <Pill tone="good">emailed</Pill>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="truncate text-xs text-ink-500" title={email.error}>
                    {email.error}
                  </span>
                  <Pill tone="warn">not sent</Pill>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
