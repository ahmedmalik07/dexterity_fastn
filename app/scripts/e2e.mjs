/**
 * End-to-end test against the deployed app.
 * Runs the full demo flow: generate -> publish -> apply (seed CV) -> stage email.
 *
 * Usage: node scripts/e2e.mjs [baseUrl] [cvPath]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] || "https://hireloop-lilac.vercel.app";
const CV = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), process.argv[3] || "../seed/1-strong-react.pdf");

const log = (...a) => console.log(...a);
const fail = (...a) => {
  console.error("FAIL:", ...a);
  process.exit(1);
};

async function step(name, fn) {
  const t0 = Date.now();
  const r = await fn();
  log(`${name} — ${(Date.now() - t0) / 1000}s`);
  return r;
}

/* 1. Generate */
const gen = await step("generate", async () => {
  const r = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ oneLiner: "Junior React dev, Islamabad, onsite, up to 80k" }),
  });
  return r.json();
});
if (!gen.ok) fail("generate:", gen.error);
const { jobId, job, variants } = gen.data;
log(`  jobId=${jobId} title="${job.title}" variants=[${Object.keys(variants)}]`);

/* 2. Publish */
const pub = await step("publish", async () => {
  const r = await fetch(`${BASE}/api/publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId, job, variants, oneLiner: "Junior React dev, Islamabad, onsite, up to 80k" }),
  });
  return r.json();
});
if (!pub.ok) fail("publish:", pub.error);
log("  channels:", pub.data.channels.map((c) => `${c.channel}:${c.ok ? "ok" : c.manual ? "manual" : "ERR " + (c.error || "").slice(0, 80)}`).join(" | "));
log("  notion:", pub.data.notionJobUrl);
const applyUrl = pub.data.applyBaseUrl + "?src=x";
log("  apply (x):", applyUrl);

/* Every variant must carry the right src tag */
for (const [ch, text] of Object.entries(pub.data.variants)) {
  const want = `src=${ch === "x" ? "x" : ch}`;
  if (!String(text).includes(want)) fail(`variant ${ch} missing tracked link ${want}`);
}
log("  tracked links: all variants carry correct src");

/* 3. Apply page loads */
const page = await fetch(`${BASE}/apply/${jobId}`);
if (!page.ok) fail("apply page:", page.status);
log("apply page —", page.status);

/* 4. Submit an application with the seed CV */
const fd = new FormData();
fd.set("name", "Ayesha Khan (e2e)");
fd.set("email", process.env.E2E_EMAIL || "ahmedusman7615@gmail.com");
fd.set("phone", "+92 300 1234567");
fd.set("linkedin", "");
fd.set("src", "x");
fd.set("jobId", jobId);
fd.set("consent", "yes");
fd.set("cv", new Blob([readFileSync(CV)], { type: "application/pdf" }), "ayesha-khan-cv.pdf");

const app = await step("apply", async () => {
  const r = await fetch(`${BASE}/api/apply`, { method: "POST", body: fd });
  return r.json();
});
if (!app.ok) fail("apply:", app.error);
log("  ok — check Notion board for the card");

/* 5. Stats */
const stats = await (await fetch(`${BASE}/api/stats/${jobId}`)).json();
log("stats:", JSON.stringify(stats.data?.perSource ?? stats));

log(`\nE2E OK — jobId=${jobId}`);
log(`Board: https://notion.so — Candidates db; drag the card to Interview to test the stage email.`);
