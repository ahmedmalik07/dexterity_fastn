/**
 * Notion, reached only through the custom Fastn connector "HireLoop Notion".
 * The Notion token lives in the Fastn connection named by FASTN_CONN_NOTION —
 * this app never holds it.
 */

import { notionCreateRow, notionQueryRows, notionUpdateRow, type FastnResult } from "./fastn";
import { env } from "./env";

/**
 * Notion silently creates a loose workspace page when `database_id` is empty, which
 * looks like success and loses the row. Refuse instead.
 */
function requireDb(id: string, which: string): FastnResult<never> | null {
  return id ? null : { ok: false, error: `${which} database id is not configured` };
}

/* ---------- helpers for Notion's property shapes ---------- */

const text = (value: string) => ({ rich_text: (value.match(/[\s\S]{1,1900}/g) ?? [""]).map(content => ({ text: { content } })) });
const title = (value: string) => ({ title: [{ text: { content: value.slice(0, 190) } }] });
const select = (value: string) => ({ select: { name: value } });
const url = (value: string) => ({ url: value || null });

export type NotionPage = { id: string; url?: string };

/* ---------- Jobs ---------- */

export type JobRow = {
  jobId: string;
  title: string;
  oneLiner: string;
  location: string;
  workMode: string;
  salaryRange: string;
  jdText: string;
  mustHaves: string[];
  niceToHaves: string[];
  applyUrl: string;
  linkedinPostUrl?: string;
  xPostUrl?: string;
  status: "Draft" | "Live" | "Closed";
};

export function createJobRow(row: JobRow): Promise<FastnResult<NotionPage>> {
  const missing = requireDb(env.notionJobsDb(), "Jobs");
  if (missing) return Promise.resolve(missing);

  return notionCreateRow<NotionPage>({ database_id: env.notionJobsDb() }, {
      Title: title(row.title),
      JobId: text(row.jobId),
      OneLiner: text(row.oneLiner),
      Location: text(row.location),
      WorkMode: select(row.workMode),
      SalaryRange: text(row.salaryRange),
      JD: text(row.jdText),
      MustHaves: text(JSON.stringify(row.mustHaves)),
      NiceToHaves: text(JSON.stringify(row.niceToHaves)),
      Status: select(row.status),
      LinkedInPostUrl: url(row.linkedinPostUrl ?? ""),
      XPostUrl: url(row.xPostUrl ?? ""),
      ApplyUrl: url(row.applyUrl),
  });
}

/* ---------- Candidates ---------- */

export type CandidateRow = {
  name: string;
  email: string;
  phone: string;
  jobId: string;
  source: string;
  score: number;
  verdict: string;
  summary: string;
  strengths: string;
  gaps: string;
  cvUrl: string;
  linkedinProfile: string;
};

export function createCandidateRow(row: CandidateRow): Promise<FastnResult<NotionPage>> {
  const missing = requireDb(env.notionCandidatesDb(), "Candidates");
  if (missing) return Promise.resolve(missing);

  return notionCreateRow<NotionPage>({ database_id: env.notionCandidatesDb() }, {
      Name: title(row.name),
      Email: { email: row.email || null },
      Phone: { phone_number: row.phone },
      JobId: text(row.jobId),
      Source: select(row.source),
      Score: { number: row.score },
      Verdict: select(row.verdict),
      Summary: text(row.summary),
      Strengths: text(row.strengths),
      Gaps: text(row.gaps),
      CvUrl: url(row.cvUrl),
      LinkedInProfile: url(row.linkedinProfile),
      Stage: select("Applied"),
      LastNotifiedStage: text("Applied"),
  });
}

/** Used by the stage notifier to record that an email went out. */
export function setLastNotifiedStage(pageId: string, stage: string): Promise<FastnResult<NotionPage>> {
  return notionUpdateRow<NotionPage>(pageId, { LastNotifiedStage: text(stage) });
}

/* ---------- queries ---------- */

export type NotionProperty = {
  rich_text?: { plain_text?: string }[];
  title?: { plain_text?: string }[];
  select?: { name?: string };
  status?: { name?: string };
  email?: string;
  number?: number;
};
export type QueryResult = {
  results: {
    id: string;
    url?: string;
    properties?: Record<string, NotionProperty>;
  }[];
};

export function queryCandidates(): Promise<FastnResult<QueryResult>> {
  const missing = requireDb(env.notionCandidatesDb(), "Candidates");
  if (missing) return Promise.resolve(missing);

  return notionQueryRows<QueryResult>(env.notionCandidatesDb(), 100);
}

/** Flattens a Notion row into the fields the app actually uses. */
export function readCandidate(page: QueryResult["results"][number]) {
  const props = page.properties ?? {};
  const plain = (key: string) => props[key]?.rich_text?.map(t => t.plain_text ?? "").join("") ?? "";
  return {
    pageId: page.id,
    name: props.Name?.title?.[0]?.plain_text ?? "Unknown",
    email: props.Email?.email ?? "",
    jobId: plain("JobId"),
    source: props.Source?.select?.name ?? "direct",
    score: typeof props.Score?.number === "number" ? props.Score.number : 0,
    verdict: props.Verdict?.select?.name ?? "Maybe",
    summary: plain("Summary"),
    // Stage may be configured as a select or a status property.
    stage: props.Stage?.select?.name ?? props.Stage?.status?.name ?? "Applied",
    lastNotifiedStage: plain("LastNotifiedStage"),
  };
}
export type Candidate = ReturnType<typeof readCandidate>;
