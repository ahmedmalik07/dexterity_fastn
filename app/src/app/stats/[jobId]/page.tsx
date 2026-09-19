import { headers } from "next/headers";
import { TopBar, Pill } from "@/components/Shell";
import StageWatcher from "./StageWatcher";

export const dynamic = "force-dynamic";

type Stats = {
  total: number;
  bySource: { source: string; count: number; avgScore: number }[];
  top: { name: string; score: number; verdict: string; source: string; summary: string }[];
};

async function getStats(jobId: string): Promise<Stats | null> {
  const host = (await headers()).get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const response = await fetch(`${protocol}://${host}/api/stats/${jobId}`, { cache: "no-store" });
  const payload = await response.json();
  return payload.ok ? payload.data : null;
}

const verdictTone = (verdict: string) =>
  verdict === "Strong" ? "good" : verdict === "Weak" ? "bad" : "warn";

export default async function StatsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const stats = await getStats(jobId);

  if (!stats) {
    return (
      <>
        <TopBar />
        <main className="mx-auto max-w-3xl px-5 py-16">
          <h1 className="text-2xl font-semibold">Channel performance unavailable</h1>
          <p className="mt-2 text-ink-600">
            The hiring board could not be read through Fastn. Check the Notion connection.
          </p>
        </main>
      </>
    );
  }

  const busiest = Math.max(1, ...stats.bySource.map((row) => row.count));

  return (
    <>
      <TopBar right={<span className="font-mono text-xs text-ink-500">{jobId}</span>} />

      <main className="mx-auto max-w-4xl px-5 py-10">
        <p className="eyebrow">Channel performance</p>
        <h1 className="mt-2 text-3xl font-semibold">Which channel actually hires for you</h1>
        <p className="mt-2 text-ink-600">
          {stats.total} applicant{stats.total === 1 ? "" : "s"} so far, each tagged with the channel
          they came from.
        </p>

        <StageWatcher jobId={jobId} />

        <section className="card mt-8 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50 text-left">
                <th className="px-5 py-3 font-medium text-ink-600">Channel</th>
                <th className="px-5 py-3 font-medium text-ink-600">Applicants</th>
                <th className="w-2/5 px-5 py-3 font-medium text-ink-600">Average score</th>
              </tr>
            </thead>
            <tbody>
              {stats.bySource.map((row) => (
                <tr key={row.source} className="border-b border-ink-100 last:border-0">
                  <td className="px-5 py-3.5 font-medium capitalize">{row.source}</td>
                  <td className="px-5 py-3.5 text-ink-700">
                    <span className="inline-flex items-center gap-2">
                      {row.count}
                      <span
                        aria-hidden="true"
                        className="inline-block h-1.5 rounded-full bg-ink-200"
                        style={{ width: `${(row.count / busiest) * 60}px` }}
                      />
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-accent-500"
                          style={{ width: `${row.avgScore}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono text-xs text-ink-600">
                        {row.avgScore}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {stats.bySource.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-ink-500">
                    No applications yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <h2 className="mt-10 text-lg font-semibold">Strongest candidates</h2>
        <ul className="mt-3 space-y-2">
          {stats.top.map((candidate) => (
            <li key={`${candidate.name}-${candidate.score}`} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{candidate.name}</span>
                <div className="flex items-center gap-2">
                  <Pill tone={verdictTone(candidate.verdict)}>{candidate.verdict}</Pill>
                  <Pill>{candidate.source}</Pill>
                  <span className="font-mono text-sm text-ink-700">{candidate.score}/100</span>
                </div>
              </div>
              <p className="mt-1.5 text-sm text-ink-600">{candidate.summary}</p>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
