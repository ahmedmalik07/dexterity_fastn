/**
 * Outbound channels: email, Slack, LinkedIn, X.
 * Each one is an HTTP call made *by Fastn*, using credentials held in a Fastn connection.
 */

import { connections, httpThroughFastn, linkedInThroughFastn, type FastnResult } from "./fastn";
import { optional } from "./env";

/* ---------- email (transactional API through Fastn) ---------- */

export function sendEmail(to: string, subject: string, body: string): Promise<FastnResult<{ id?: string }>> {
  const from = optional("EMAIL_FROM", "HireLoop <onboarding@resend.dev>");
  return httpThroughFastn(connections.email(), "POST", optional("EMAIL_API_HOST", "api.resend.com"), "/emails", {
    from,
    to: [to],
    subject,
    text: body,
  });
}

/* ---------- Slack ---------- */

/** Slack answers 200 even when it refuses, so the real verdict is the `ok` field. */
export async function slackAlert(text: string): Promise<FastnResult<{ ts?: string }>> {
  const result = await httpThroughFastn<{ ok?: boolean; error?: string; ts?: string }>(
    connections.slack(),
    "POST",
    "slack.com",
    "/api/chat.postMessage",
    { channel: optional("HR_SLACK_CHANNEL", "#hiring"), text, mrkdwn: true },
  );

  if (!result.ok) return result;
  if (!result.data?.ok) {
    return { ok: false, error: `Slack refused: ${result.data?.error ?? "unknown error"}` };
  }
  return result;
}

/* ---------- LinkedIn ---------- */

/** Needs LINKEDIN_AUTHOR_URN (e.g. urn:li:person:xxxx) and a connection holding the token. */
export async function postToLinkedIn(text: string): Promise<FastnResult<{ id?: string }>> {
  const author = optional("LINKEDIN_AUTHOR_URN");
  if (!author) return { ok: false, error: "LINKEDIN_AUTHOR_URN not set" };

  return linkedInThroughFastn({
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  });
}

export function linkedInPostUrl(id?: string): string | undefined {
  return id ? `https://www.linkedin.com/feed/update/${id}` : undefined;
}

/* ---------- X ---------- */

export function postToX(text: string): Promise<FastnResult<{ data?: { id?: string } }>> {
  return httpThroughFastn(connections.x(), "POST", "api.x.com", "/2/tweets", { text });
}

export function xPostUrl(id?: string): string | undefined {
  const handle = optional("X_HANDLE", "i");
  return id ? `https://x.com/${handle}/status/${id}` : undefined;
}
