#!/usr/bin/env node
/**
 * Fastn setup helper.
 *
 * Fastn's OAuth connectors need a browser, but its generic HTTP connector accepts a
 * token directly — so every service this app uses can be wired up from the terminal.
 *
 *   node scripts/fastn.mjs list
 *   node scripts/fastn.mjs connect notion   <notion-internal-integration-token>
 *   node scripts/fastn.mjs connect email    <resend-api-key>
 *   node scripts/fastn.mjs connect slack    <slack-bot-token>
 *   node scripts/fastn.mjs connect linkedin <linkedin-access-token>
 *   node scripts/fastn.mjs connect x        <x-oauth2-access-token>
 *   node scripts/fastn.mjs init-notion      <notion-parent-page-id>
 *   node scripts/fastn.mjs test-notion
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/* ---- env ---- */
function loadEnv() {
  try {
    const raw = readFileSync(join(here, "..", ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  } catch {
    /* no .env.local yet */
  }
}
loadEnv();

const API_KEY = process.env.FASTN_API_KEY;
const BASE = (process.env.FASTN_API_BASE || "https://api.fastn.dev/api/v1").replace(/\/$/, "");
if (!API_KEY) {
  console.error("FASTN_API_KEY is not set (put it in app/.env.local)");
  process.exit(1);
}

const HTTP_CONNECTOR = "b77f2010-181e-4a97-8094-4d3c513322d9";
const INPUT_AUTH = "311ac194-423f-4bc2-ba57-32977e38de4e";
const ACTIONS = {
  GET: "f811b301-0b2f-4874-8f0f-b122c8d0ff97",
  POST: "84c4cec4-b08e-4ff0-820a-3871246b10e7",
  PATCH: "1f6d5cd9-3be6-4f09-aa71-fe5fe50e9c65",
};

async function api(path, method = "GET", body) {
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${API_KEY}`,
  };
  if (API_KEY.startsWith("fsk_test_")) headers["X-fastn-Test-Mode"] = "true";

  const response = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: text };
  }
}

/** Run an HTTP call through Fastn, exactly as the app does. */
async function through(connectionName, verb, host, path, body) {
  const input = { host, path };
  if (body !== undefined) input.body = body;
  const { body: reply } = await api(`/actions/${ACTIONS[verb]}/execute`, "POST", {
    connectorId: HTTP_CONNECTOR,
    connectionName,
    input,
  });
  return reply?.data ?? reply;
}

/** Notion goes through its own connector, which adds the Notion-Version header. */
const NOTION_ACTIONS = {
  GET: () => process.env.FASTN_NOTION_GET || "19e90fb7-2312-4a61-998d-29ee62f52387",
  POST: () => process.env.FASTN_NOTION_POST || "b1f54c39-0517-464a-bd40-5cc73051f05e",
  PATCH: () => process.env.FASTN_NOTION_PATCH || "18cd80db-e64c-4288-b7f8-d469abc2a139",
};

async function notionCall(verb, path, body) {
  const input = { path };
  if (body !== undefined) input.body = body;
  const { body: reply } = await api(`/actions/${NOTION_ACTIONS[verb]()}/execute`, "POST", {
    connectorId: process.env.FASTN_NOTION_CONNECTOR || "77182b4f-84f2-4099-ba03-950707c2ec79",
    connectionName: process.env.FASTN_CONN_NOTION || "hireloop-notion",
    input,
  });
  return reply?.data ?? reply;
}

/* ---- services ---- */

/**
 * Notion and LinkedIn need an extra header that Fastn's generic HTTP connector cannot
 * send, so each has its own custom Fastn connector (created by `setup-connectors`).
 * Slack, X and the email API only need a bearer token, so they use the generic one.
 */
const SERVICES = {
  notion: {
    conn: "FASTN_CONN_NOTION",
    connector: () => process.env.FASTN_NOTION_CONNECTOR || "77182b4f-84f2-4099-ba03-950707c2ec79",
    auth: () => process.env.FASTN_NOTION_AUTH || "db98d137-5761-4342-a757-644af34997e5",
    credentials: (token) => ({ token }),
  },
  linkedin: {
    conn: "FASTN_CONN_LINKEDIN",
    connector: () => process.env.FASTN_LINKEDIN_CONNECTOR || "71c26754-1eae-49de-ada6-8019fb69c991",
    auth: () => process.env.FASTN_LINKEDIN_AUTH || "06e03806-7247-485a-9d33-5ff756dcd8ec",
    credentials: (token) => ({ token }),
  },
  email: { conn: "FASTN_CONN_EMAIL", credentials: (token) => ({ headerName: "Authorization", apiKey: `Bearer ${token}` }) },
  slack: { conn: "FASTN_CONN_SLACK", credentials: (token) => ({ headerName: "Authorization", apiKey: `Bearer ${token}` }) },
  x: { conn: "FASTN_CONN_X", credentials: (token) => ({ headerName: "Authorization", apiKey: `Bearer ${token}` }) },
};

async function connect(service, token) {
  const config = SERVICES[service];
  if (!config) throw new Error(`Unknown service: ${service}`);

  const name = process.env[config.conn] || `hireloop-${service}`;

  const { status, body } = await api("/connections", "POST", {
    connectorId: config.connector ? config.connector() : HTTP_CONNECTOR,
    authMethodId: config.auth ? config.auth() : INPUT_AUTH,
    name,
    credentials: config.credentials(token),
  });

  if (status >= 300) {
    console.error(`✗ ${service}:`, JSON.stringify(body).slice(0, 300));
    process.exit(1);
  }
  console.log(`✓ connected ${service} as Fastn connection "${name}"`);
}

/* ---- Notion database creation ---- */

const JOBS_SCHEMA = {
  Title: { title: {} },
  JobId: { rich_text: {} },
  OneLiner: { rich_text: {} },
  Location: { rich_text: {} },
  WorkMode: { select: { options: [{ name: "Onsite" }, { name: "Hybrid" }, { name: "Remote" }] } },
  SalaryRange: { rich_text: {} },
  JD: { rich_text: {} },
  MustHaves: { rich_text: {} },
  NiceToHaves: { rich_text: {} },
  Status: { select: { options: [{ name: "Draft" }, { name: "Live" }, { name: "Closed" }] } },
  LinkedInPostUrl: { url: {} },
  XPostUrl: { url: {} },
  ApplyUrl: { url: {} },
};

const CANDIDATES_SCHEMA = {
  Name: { title: {} },
  Email: { email: {} },
  Phone: { phone_number: {} },
  JobId: { rich_text: {} },
  Source: {
    select: {
      options: ["linkedin", "x", "facebook", "whatsapp", "discord", "direct", "slack"].map((name) => ({ name })),
    },
  },
  Score: { number: {} },
  Verdict: { select: { options: [{ name: "Strong" }, { name: "Maybe" }, { name: "Weak" }] } },
  Summary: { rich_text: {} },
  Strengths: { rich_text: {} },
  Gaps: { rich_text: {} },
  CvUrl: { url: {} },
  LinkedInProfile: { url: {} },
  Stage: {
    select: {
      options: [
        { name: "Applied" },
        { name: "Shortlisted" },
        { name: "Interview" },
        { name: "Offer" },
        { name: "Rejected" },
      ],
    },
  },
  LastNotifiedStage: { rich_text: {} },
};

async function initNotion(parentPageId) {
  const pageId = parentPageId.replace(/-/g, "");

  for (const [label, properties] of [
    ["HireLoop Jobs", JOBS_SCHEMA],
    ["HireLoop Candidates", CANDIDATES_SCHEMA],
  ]) {
    const result = await notionCall("POST", "/v1/databases", {
      parent: { type: "page_id", page_id: pageId },
      title: [{ type: "text", text: { content: label } }],
      properties,
    });

    if (!result?.success) {
      console.error(`✗ ${label}:`, JSON.stringify(result?.response ?? result).slice(0, 400));
      process.exit(1);
    }
    const id = result.response?.id;
    const envName = label.includes("Jobs") ? "NOTION_JOBS_DB_ID" : "NOTION_CANDIDATES_DB_ID";
    console.log(`✓ ${label}\n   ${envName}=${id}`);
  }
  console.log("\nPut those two ids in app/.env.local, then restart the dev server.");
}

async function testNotion() {
  const result = await notionCall("GET", "/v1/users/me");
  console.log(result?.success ? `✓ Notion reachable through Fastn as: ${result.response?.name ?? "bot"}` : `✗ ${JSON.stringify(result?.response ?? result).slice(0, 300)}`);
}

/* ---- main ---- */

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "list": {
    const { body } = await api("/connections");
    const rows = body?.data ?? [];
    if (!rows.length) console.log("No Fastn connections yet.");
    for (const row of rows) console.log(`- ${row.name} (${row.authType}, ${row.status})`);
    break;
  }
  case "connect":
    if (args.length < 2) {
      console.error("usage: node scripts/fastn.mjs connect <notion|email|slack|linkedin|x> <token>");
      process.exit(1);
    }
    await connect(args[0], args[1]);
    break;
  case "init-notion":
    if (!args[0]) {
      console.error("usage: node scripts/fastn.mjs init-notion <notion-parent-page-id>");
      process.exit(1);
    }
    await initNotion(args[0]);
    break;
  case "test-notion":
    await testNotion();
    break;
  default:
    console.log(readFileSync(new URL(import.meta.url)).toString().split("*/")[0].split("/**")[1]);
}
