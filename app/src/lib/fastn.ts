/**
 * The only door to the outside world.
 *
 * Every third-party service (Notion, Slack, email, LinkedIn, X) is reached through
 * Fastn's action API. The app holds no Notion/Slack/social credentials of its own:
 * those live in Fastn connections, and we name the connection we want.
 *
 * Contract (verified against api.fastn.dev on 2026-09-19):
 *   POST {base}/actions/{actionId}/execute
 *   headers: Authorization: Bearer <api key>, X-fastn-Test-Mode: true (test keys only)
 *   body:    { connectorId, connectionName, input: { ... } }
 *   reply:   { data: { success, status, response, durationMs } }
 */

import { optional, required } from "./env";

/** Fastn's generic HTTP connector and its five verb actions. */
export const HTTP_CONNECTOR = "b77f2010-181e-4a97-8094-4d3c513322d9";
const HTTP_ACTIONS = {
  GET: "f811b301-0b2f-4874-8f0f-b122c8d0ff97",
  POST: "84c4cec4-b08e-4ff0-820a-3871246b10e7",
  PATCH: "1f6d5cd9-3be6-4f09-aa71-fe5fe50e9c65",
  PUT: "54377b81-f7c3-4313-945e-c6676df45431",
  DELETE: "56a30e8a-5c65-4f7d-a887-cf7c95a5528d",
} as const;

export type HttpVerb = keyof typeof HTTP_ACTIONS;

export type FastnResult<T = unknown> = {
  ok: boolean;
  status?: number;
  data?: T;
  error?: string;
};

const TIMEOUT_MS = 30_000;

function fastnBase(): string {
  return optional("FASTN_API_BASE", "https://api.fastn.dev/api/v1").replace(/\/$/, "");
}

function headers(): Record<string, string> {
  const key = required("FASTN_API_KEY");
  const head: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${key}`,
  };
  // Test keys (fsk_test_...) are rejected unless they declare test mode.
  if (key.startsWith("fsk_test_") || optional("FASTN_TEST_MODE") === "true") {
    head["X-fastn-Test-Mode"] = "true";
  }
  return head;
}

/** Run any Fastn connector action. */
export async function executeAction<T = unknown>(
  actionId: string,
  connectorId: string,
  connectionName: string,
  input: Record<string, unknown>,
): Promise<FastnResult<T>> {
  if (!connectionName) {
    return { ok: false, error: "No Fastn connection configured for this step" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${fastnBase()}/actions/${actionId}/execute`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ connectorId, connectionName, input }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, error: `Fastn ${response.status}: ${text.slice(0, 300)}` };
    }

    // Fastn always replies 200; the real outcome is inside data.
    const envelope = JSON.parse(text) as {
      data?: { success?: boolean; status?: number; response?: unknown };
    };
    const result = envelope.data;

    if (!result?.success) {
      return {
        ok: false,
        status: result?.status,
        error: `Upstream ${result?.status ?? "error"}: ${JSON.stringify(result?.response ?? {}).slice(0, 300)}`,
      };
    }

    return { ok: true, status: result.status, data: result.response as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: /abort/i.test(message) ? "Fastn timed out" : message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Make an HTTP call to a third-party API through Fastn.
 * The connection supplies the auth header, so no tokens ever live in this app.
 */
export async function httpThroughFastn<T = unknown>(
  connectionName: string,
  verb: HttpVerb,
  host: string,
  path: string,
  body?: unknown,
): Promise<FastnResult<T>> {
  const input: Record<string, unknown> = { host, path };
  if (body !== undefined) input.body = body;
  return executeAction<T>(HTTP_ACTIONS[verb], HTTP_CONNECTOR, connectionName, input);
}

/**
 * Two custom connectors were created in Fastn for APIs that need an extra header,
 * which the generic HTTP connector cannot send:
 *   - Notion  needs Notion-Version
 *   - LinkedIn needs X-Restli-Protocol-Version
 * Their ids live in env so a different Fastn workspace can be pointed at without code edits.
 */
const NOTION_CONNECTOR = () => optional("FASTN_NOTION_CONNECTOR", "77182b4f-84f2-4099-ba03-950707c2ec79");

/**
 * Each Notion operation is its own Fastn action with an explicit body template.
 * A single generic "pass the whole body through" action is not usable here: Fastn's
 * `{{input.body}}` substitution drops nested objects, which silently cost us the
 * `parent` field and created loose workspace pages instead of database rows.
 */
export function notionCreateRow<T = unknown>(
  parent: unknown,
  properties: unknown,
): Promise<FastnResult<T>> {
  return executeAction<T>(
    optional("FASTN_NOTION_CREATE_ROW", "360b99ea-8a76-4d43-811f-0451741702dc"),
    NOTION_CONNECTOR(),
    connections.notion(),
    { parent, properties },
  );
}

export function notionUpdateRow<T = unknown>(
  pageId: string,
  properties: unknown,
): Promise<FastnResult<T>> {
  return executeAction<T>(
    optional("FASTN_NOTION_UPDATE_ROW", "f35d664c-90b8-471e-8fed-1feeed7fd746"),
    NOTION_CONNECTOR(),
    connections.notion(),
    { pageId, properties },
  );
}

export function notionQueryRows<T = unknown>(
  databaseId: string,
  pageSize = 100,
): Promise<FastnResult<T>> {
  return executeAction<T>(
    optional("FASTN_NOTION_QUERY_ROWS", "9335448b-bf73-4879-9cd1-39f92cb94f55"),
    NOTION_CONNECTOR(),
    connections.notion(),
    { databaseId, pageSize },
  );
}

export function linkedInThroughFastn<T = unknown>(body: unknown): Promise<FastnResult<T>> {
  return executeAction<T>(
    optional("FASTN_LINKEDIN_POST", "c1a5e164-6177-4d5d-8c81-8520ada01980"),
    optional("FASTN_LINKEDIN_CONNECTOR", "71c26754-1eae-49de-ada6-8019fb69c991"),
    connections.linkedin(),
    { body },
  );
}

/** Named connections, configured in env so the demo can be re-pointed without code edits. */
export const connections = {
  notion: () => optional("FASTN_CONN_NOTION"),
  slack: () => optional("FASTN_CONN_SLACK"),
  email: () => optional("FASTN_CONN_EMAIL"),
  linkedin: () => optional("FASTN_CONN_LINKEDIN"),
  x: () => optional("FASTN_CONN_X"),
};

export type ChannelResult = {
  channel: string;
  ok: boolean;
  url?: string;
  error?: string;
  /** True when the channel has no API at all and the recruiter posts it by hand. */
  manual?: boolean;
};

/** Runs a step so that one dead channel never takes the others down with it. */
export async function channelStep<T>(
  channel: string,
  run: () => Promise<FastnResult<T>>,
): Promise<ChannelResult & { data?: T }> {
  try {
    const result = await run();
    return result.ok
      ? { channel, ok: true, data: result.data }
      : { channel, ok: false, error: result.error };
  } catch (error) {
    return { channel, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
