# HireLoop — post once, hire anywhere

**Live: https://hireloop-lilac.vercel.app** · [Download the desktop companion](https://github.com/ahmedmalik07/dexterity_fastn/releases/tag/v1.9.0)

## For judges — 90 seconds, nothing to install

1. Open **https://hireloop-lilac.vercel.app/compose**
2. Type one line: `Junior React dev, Islamabad, onsite, up to 80k`
3. **Generate** → you get a full job description and a version for LinkedIn, X,
   Facebook, WhatsApp and Discord, each carrying the same apply link with its own
   source tag
4. **Publish** → the hiring board row is created through Fastn and a QR code appears
5. **Scan the QR with your phone** and apply with any PDF CV
6. Your CV is read and scored against the role, and you appear on the board:
   [hiring board](https://notion.so/3e06f9d69b1c818e924de84e08197512)
7. Open **Stats → Watch the board**, then move a card in Notion — that candidate
   is emailed within seconds

Every outbound action — the hiring board, the emails, the alerts — goes through
**Fastn** connectors. The app holds no Notion, Slack or email credentials of its own.

### What will not work, and why

| | |
|---|---|
| LinkedIn / X posting | Fastn has no connector for either, and we have no developer tokens for them. Both come back written and ready to paste. |
| Facebook / WhatsApp groups | Meta closed the Groups API and WhatsApp has never had one. No tool can post there. |
| The confirmation email | The Resend account is unverified, so it only reaches the account owner's address until a domain is added. |

We would rather show you this table than a demo that quietly fakes those steps.

---

A Windows companion that sees your screen and helps without you leaving what you are
doing. No screenshotting your work into Claude, Cursor or ChatGPT and retyping the
question: it is already there, beside the cursor.

**Publish a role** is a module inside it, built for the "Build with Fastn" hackathon.

## The module, in one move

You are in a Slack thread where the team agrees to hire someone. You do not retype
anything:

1. **Capture** — Dexterity reads the role off the screen you are already looking at.
   From a real Slack thread it produced: `Junior React dev, Islamabad, onsite, up to 80k PKR per month`
2. **Write** — one line becomes a full job description plus a version for LinkedIn, X,
   Facebook, WhatsApp and Discord, each carrying the same apply link with its own source tag.
3. **Publish** — everything with a connector goes out through Fastn. Everything without
   one comes back written and ready to paste.

Open Dexterity → **Publish a role** in the sidebar.

```
dexterity/electron/publish.cjs   the module
dexterity/ui/publish.js          its screen
app/                             the service it calls (Next.js), which owns the Fastn wiring
```

The service must be running: `cd app && npm run dev`.

---

## The edge

> Fastn connects every app that has an API. We added the ones that don't.

Hiring in Pakistan happens in WhatsApp groups, Facebook groups and DMs. Meta closed the
Facebook Groups API and WhatsApp has never had one for groups — **no tool can post or read
there, Fastn included**. So HireLoop reads the candidate straight off the recruiter's
screen: screenshot a WhatsApp message, and the candidate joins the same pipeline as a
formal applicant, filed through Fastn like everything else.

That path is available two ways:

- **In the browser** at `/capture` — paste a screenshot with Ctrl+V.
- **From the desktop** — `dexterity/`, an isolated copy of the Dexterity companion, with a
  bridge that sends what is on screen to HireLoop. Right-click the companion orb →
  **Send screen to HireLoop**.

## How Fastn is used

The app talks to **no third-party service directly**. Notion, Slack, email, LinkedIn and X
are all reached through Fastn connector actions, and credentials live in Fastn connections
rather than in this app. Only two outbound calls bypass Fastn, by design: Gemini (the AI)
and Vercel Blob (CV storage).

| Fastn connector | Used for | Why |
|---|---|---|
| `HTTP API` (built in) | Slack, email API | A bearer token is all they need |
| `HireLoop Notion` (custom) | The hiring board | Notion also needs a `Notion-Version` header, which the generic connector cannot send |
| `HireLoop LinkedIn` (custom) | LinkedIn posts | Needs `X-Restli-Protocol-Version: 2.0.0` |

Both custom connectors, and their actions, were created programmatically through
`api.fastn.dev/api/v1`. Two findings worth knowing if you build on this:

- A Fastn action must use an explicit `bodyTemplate` (`{"parent": {{input.parent}}, …}`).
  A generic `{{input.body}}` pass-through **drops nested objects**, which silently cost us
  the Notion `parent` field and created loose workspace pages instead of database rows.
- Test API keys (`fsk_test_…`) are rejected unless the request also sends
  `X-fastn-Test-Mode: true`.

## What actually works right now

| Channel | Status |
|---|---|
| Notion hiring board | Working — job rows and scored candidate cards |
| Candidate email (Resend) | Working, but the Resend account is unverified, so it can **only send to the account owner's address** (`daniyalhero07@gmail.com`). Verify a domain at resend.com/domains before the demo, or judges get no email. |
| Slack alerts | Authenticates, but the token is missing the `chat:write` scope |
| LinkedIn / X posting | **Not posting.** No credentials, and Fastn has no LinkedIn or X connector — the custom ones need your own developer tokens. They fall back to copy-and-paste. |
| Facebook / WhatsApp / Discord | Copy-and-paste by design; no API exists |

## Layout

```
app/                    Next.js 16 app (App Router, TypeScript, Tailwind v4)
  src/lib/fastn.ts      the only door to the outside world
  src/lib/notion.ts     Jobs + Candidates rows, through Fastn
  src/lib/channels.ts   email, Slack, LinkedIn, X, through Fastn
  src/lib/vision.ts     reads a candidate out of a screenshot
  src/lib/ai.ts         JSON-validated AI with one retry and model fallback
  scripts/fastn.mjs     connect services, create the Notion databases
dexterity/              isolated copy of the desktop companion
  electron/hireloop.cjs the bridge to /api/capture
seed/                   five test CVs and a mock WhatsApp screenshot
```

## Pages

- `/compose` — one line in, JD plus five platform versions out, then publish.
- `/apply/[jobId]` — public, mobile first, tags the source from `?src=`.
- `/capture` — pull a candidate out of a screenshot.
- `/stats/[jobId]` — applicants and average score per channel.

## Setup

```bash
cd app && npm install && cp .env.example .env.local
```

Fill in `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`) and `FASTN_API_KEY`, then:

```bash
node scripts/fastn.mjs connect notion <notion-integration-token>
node scripts/fastn.mjs connect email <resend-api-key>
node scripts/fastn.mjs connect slack <slack-bot-token>
node scripts/fastn.mjs init-notion <notion-parent-page-id>
```

Put the two printed database ids in `.env.local`, then `npm run dev`.

The parent page must be a normal page. A Notion **person profile** page cannot hold
content and the API rejects it.

Seed data: `node scripts/make-seed-cvs.mjs`.

## Stage emails

Move a card on the Notion board and the candidate hears about it. `lib/stages.ts` reads
the board through Fastn, emails anyone whose `Stage` differs from `LastNotifiedStage`,
then writes the stage back through Fastn so nothing is ever sent twice.

Two things run it:

- **The pipeline page** (`/stats/<jobId>`) — press **Watch the board** and it checks every
  12 seconds while you have it open. This is what to use in a demo.
- **A daily Vercel cron** at 04:00, protected by `CRON_SECRET`. The free plan refuses
  minute-by-minute schedules, which is why the page does the live watching.

## Gemini quota

The free tier limits requests **per minute per model**, so several people applying at
once will rate-limit a single model and land as "Scoring failed". `GEMINI_MODEL` is a
comma-separated chain (six models by default) and `lib/models.ts` walks it, then waits
and walks it once more. Verified with three simultaneous applicants: all three scored.

## Live

https://hireloop-lilac.vercel.app
