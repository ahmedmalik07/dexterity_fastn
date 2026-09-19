import { NextResponse } from "next/server";
import { queryCandidates, readCandidate } from "@/lib/notion";

export const runtime = "nodejs";

/** W4 — applicants per source, average score per source, top 5. Read via Fastn. */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  const query = await queryCandidates();
  if (!query.ok || !query.data) {
    return NextResponse.json({ ok: false, error: query.error ?? "Notion query failed" }, { status: 502 });
  }

  const candidates = (query.data.results ?? []).map(readCandidate).filter((c) => c.jobId === jobId);

  const bySource = new Map<string, number[]>();
  for (const candidate of candidates) {
    const scores = bySource.get(candidate.source) ?? [];
    scores.push(candidate.score);
    bySource.set(candidate.source, scores);
  }

  return NextResponse.json({
    ok: true,
    data: {
      total: candidates.length,
      bySource: [...bySource.entries()]
        .map(([source, scores]) => ({
          source,
          count: scores.length,
          avgScore: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
        }))
        .sort((a, b) => b.count - a.count),
      top: [...candidates].sort((a, b) => b.score - a.score).slice(0, 5),
    },
  });
}
