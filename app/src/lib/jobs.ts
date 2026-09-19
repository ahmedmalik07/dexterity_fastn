/**
 * Job lookup for the public apply page.
 *
 * Three layers, fastest first:
 *   1. process memory  - warm requests on the same instance
 *   2. Vercel Blob     - a small public JSON written at publish time (optional)
 *   3. Notion, via Fastn - the source of truth, so the page survives a restart and
 *                          works on serverless where memory is never shared
 *
 * Layer 3 matters: without it the apply link dies whenever the server recycles.
 */

import { put, list } from "@vercel/blob";
import { PublicJobSchema, type PublicJob } from "./schemas";
import { notionQueryRows } from "./fastn";
import { env } from "./env";
import type { NotionProperty } from "./notion";

const PREFIX = "jobs/";
const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const memory = new Map<string, PublicJob>();

export async function saveJob(job: PublicJob): Promise<void> {
  memory.set(job.jobId, job);
  if (!blobEnabled()) return;

  try {
    await put(`${PREFIX}${job.jobId}.json`, JSON.stringify(job), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch {
    /* Notion remains the fallback. */
  }
}

export async function loadJob(jobId: string): Promise<PublicJob | null> {
  const cached = memory.get(jobId);
  if (cached) return cached;

  const fromBlob = await loadFromBlob(jobId);
  if (fromBlob) {
    memory.set(jobId, fromBlob);
    return fromBlob;
  }

  const fromNotion = await loadFromNotion(jobId);
  if (fromNotion) {
    memory.set(jobId, fromNotion);
    return fromNotion;
  }

  return null;
}

async function loadFromBlob(jobId: string): Promise<PublicJob | null> {
  if (!blobEnabled()) return null;
  try {
    const { blobs } = await list({ prefix: `${PREFIX}${jobId}.json`, limit: 1 });
    if (!blobs.length) return null;

    const response = await fetch(blobs[0].url, { cache: "no-store" });
    if (!response.ok) return null;

    return PublicJobSchema.parse(await response.json());
  } catch {
    return null;
  }
}

type JobsQuery = {
  results: { properties?: Record<string, NotionProperty> }[];
};

/** Read the job back out of the Notion Jobs board, through Fastn. */
async function loadFromNotion(jobId: string): Promise<PublicJob | null> {
  const database = env.notionJobsDb();
  if (!database) return null;

  const query = await notionQueryRows<JobsQuery>(database, 100);
  if (!query.ok || !query.data?.results) return null;

  const plain = (props: Record<string, NotionProperty>, key: string) =>
    props[key]?.rich_text?.map(t => t.plain_text ?? "").join("") ?? "";

  const row = query.data.results.find((page) => plain(page.properties ?? {}, "JobId") === jobId);
  if (!row?.properties) return null;

  const props = row.properties;
  const parseList = (value: string): string[] => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };

  return {
    jobId,
    title: props.Title?.title?.[0]?.plain_text ?? "This role",
    location: plain(props, "Location"),
    workMode: props.WorkMode?.select?.name ?? "",
    salaryRange: plain(props, "SalaryRange"),
    summary: plain(props, "OneLiner"),
    jdText: plain(props, "JD"),
    responsibilities: [],
    mustHaves: parseList(plain(props, "MustHaves")),
    niceToHaves: parseList(plain(props, "NiceToHaves")),
  };
}
