/**
 * Central place for environment variables.
 * Nothing here throws at import time: the app must still boot (and render helpful
 * errors) when a hackathon judge clones it without every key configured.
 */

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function optional(name: string, fallback = ""): string {
  return process.env[name] || fallback;
}

export const env = {
  anthropicKey: () => required("ANTHROPIC_API_KEY"),
  anthropicModel: () => optional("ANTHROPIC_MODEL", "claude-sonnet-5"),

  baseUrl: () => optional("NEXT_PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/$/, ""),

  // Fastn: the app never calls LinkedIn / X / Notion / Gmail / Slack / Discord itself.
  fastnSecret: () => optional("FASTN_WEBHOOK_SECRET"),
  fastnPublishUrl: () => optional("FASTN_W1_PUBLISH_URL"),
  fastnIngestUrl: () => optional("FASTN_W2_INGEST_URL"),
  fastnStatsUrl: () => optional("FASTN_W4_STATS_URL"),

  // Direct Fastn UCL API (used when a flow webhook is not configured).
  fastnApiKey: () => optional("FASTN_API_KEY"),
  fastnSpaceId: () => optional("FASTN_SPACE_ID"),
  fastnApiBase: () => optional("FASTN_API_BASE", "https://live.fastn.ai/api/ucl"),

  notionJobsDb: () => optional("NOTION_JOBS_DB_ID"),
  notionCandidatesDb: () => optional("NOTION_CANDIDATES_DB_ID"),

  interviewBookingUrl: () => optional("INTERVIEW_BOOKING_URL"),
  hrSlackChannel: () => optional("HR_SLACK_CHANNEL"),
  discordChannelId: () => optional("DISCORD_CHANNEL_ID"),
};

/** True when the app can reach Fastn at all (either a flow webhook or the UCL API). */
export function fastnConfigured(): boolean {
  return Boolean(
    env.fastnPublishUrl() || env.fastnIngestUrl() || (env.fastnApiKey() && env.fastnSpaceId()),
  );
}
