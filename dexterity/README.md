# Dexterity

A Windows companion beside your cursor. Talk about what you see, learn an app one step at a time, and hand longer work to a background agent.

The 1.9 direction follows the interaction described by [HeyClicky](https://www.heyclicky.com/) and its [YC profile](https://www.ycombinator.com/companies/heyclicky): conversation, screen guidance, and independent background work. This is an independent implementation, not HeyClicky or a claim of full feature parity.

## Start

On Windows with dependencies installed, run `npm start` or open **Start Dexterity.cmd**. For a fresh checkout, install Node.js 22.12+ and run `npm install` first.

Connect OpenRouter, OpenAI, or Gemini in **Settings**. Automatic cloud voice uses OpenRouter or Gemini; direct OpenAI alone provides text/screen answers, while voice falls back to Windows speech recognition.

- **Talk:** click the cursor companion or hold Ctrl for three seconds. Speak, then pause. The reply appears beside the cursor without opening the dashboard.
- **Type:** choose **Type instead**. Ask and follow up in the floating card. Enter sends; Shift+Enter adds a line.
- **Hands-free:** choose **Hands-free** in the floating card. With cloud voice connected, Dexterity listens again after each reply finishes. **End hands-free**, Cancel, or Escape ends the session. Sessions end after ten minutes and individual recordings are limited to 15 seconds. This is turn-based voice; it does not listen while speaking.
- **Conversations:** optionally enable **Remember conversations on this PC**, then continue or delete saved chats from this page. **New chat** starts a separate conversation.
- **Learn:** ask “Teach me how to use this app” or “Where is this setting?” A visual marker can identify a visible target. **I did it** captures the updated screen and continues the original lesson.
- **General conversation:** turn off **See my screen** in the floating card.
- **Background work:** open **Background tasks**, or say “Dexterity agent, build me a countdown timer.” The agent works separately while the companion remains available.
- **Stop:** Escape stops the screen conversation. Background tasks have their own Stop button. Quitting the app stops its running background jobs.

## Background agents

Background work uses an installed, signed-in **Codex CLI**, discovered on PATH or in the Windows Codex desktop installation. It uses that account’s normal usage limits; the screen companion’s provider key does not authenticate it. Install/sign in to the CLI before starting a background task on another PC.

Each job gets a separate folder under `%APPDATA%/dexterity/background-tasks`. The runtime uses its workspace-write sandbox; Dexterity does not disable it. Jobs can create and verify files and use the runtime’s available research tools. Authentication, network, sandbox, or provider failures appear in the result. Research availability depends on the runtime’s configured tools. There are no built-in Gmail, Calendar, or Notion connections in this app.

The task list shows progress and the final answer. **Preview files** displays generated text and images inside Dexterity; **Open files** opens the job folder. **Continue / retry** preserves that folder and provides the previous result to the next run. Up to two jobs can work concurrently. Interrupted jobs are marked after a restart, rather than shown as still running.

Runtime integration follows [Codex non-interactive mode](https://developers.openai.com/codex/noninteractive).

## Data and limitations

Screen conversations send the requested screenshot, visible accessibility text, selected text, recent conversation, and enabled relevant memories to the configured AI. Screenshots are kept in memory. Cloud voice sends the activated recording after recording stops. Recordings have a 15-second limit. Hands-free mode starts another recording after the reply, until you stop it or the ten-minute session expires.

API keys and saved personal context use Electron safeStorage / Windows encryption. Background task requests and results are encrypted in `jobs.vault`; generated files are ordinary local files in the task folder. The Codex runtime also follows its own session-storage settings. Screen conversations use the latest six exchanges as context. Optional saved history keeps up to 50 chats with 100 turns each in encrypted `conversations.vault`, without screenshots or audio. Turning saving off stops new saves; existing chats remain until deleted. **New chat** clears the active context.

Visual markers are model-proposed locations, not a guarantee of pixel accuracy. Markers expire and reject a target window that moved or changed size. The assistant captures a fresh screen for the next request; it does not continuously watch your work.

This release does not implement HeyClicky’s full-duplex realtime voice, named persistent agent personalities, account/app integrations, input file attachments, or recurring routines. Local form automation from earlier versions remains in the code for regression/reference, but is removed from the main navigation and spoken imperative routing. Saying “click” or “fill” now asks the companion for help; it does not silently start that old automation loop.

## Verification

- `npm test`: 61 unit checks, including conversation intent, target retention, background job isolation, progress, completion, cancellation, interrupted-job recovery, hands-free lifecycle, saved history, and file preview boundaries.
- `npm run test:companion`: launches Electron and exercises typed conversation, history, screen opt-out, lesson continuation, generated microphone audio, transcription, actual screen capture, and the drawing overlay. AI responses are fixtures; no real microphone is used.
- `node scripts/verify-background.cjs`: opt-in live Codex test that creates and reads back a small output file. This uses the signed-in account and consumes normal usage.
- `node tests/background-desktop.cjs`: opt-in live check of the background task UI through to a verified output file and its in-app preview.

The updated source companion test (including hands-free rearming, microphone release, and saved history) and live background UI/file-preview test passed on 16 September 2026. The live OpenRouter visual-guidance test passed on 13 September 2026. `node scripts/verify-companion-live.cjs` uses a rendered sample photo-editor screen and the saved provider connection; it does not upload your desktop. Generated-audio tests establish wiring, not recognition accuracy for a person’s accent or room.

`npm run dist` builds the Windows portable release in `release-v1.9`. Windows Code Integrity events 3033 and 3077 confirmed that the previous unsigned packaged executable failed this PC’s Enterprise signing requirements on 13 September 2026. Run `npm run dist:signed` with a configured signing certificate for a signed distribution. Source-launch success does not establish that the packaged release is permitted by Windows. Do not disable Windows security to run it.

Earlier architecture/demo/gallery documents describe the 1.7 prototype and should be treated as historical where they conflict with this README.

## State of this copy (hackathon fork)

Every feature is reachable from the sidebar again. In 1.9 the nav whitelisted two
entries, which left form filling, the task and teaching surface, the publish module,
the playbook and the team page unreachable in the UI despite working in code.

Fixed here:

- **Nav** — only the legacy overview is hidden now; the companion home replaced it.
- **Companion toggle** — turning the floating companion off used to be a one-way trip,
  because the only toggle lived on the hidden overview page. The companion home has its
  own toggle now.
- **Sidebar** — with every entry visible it could outgrow a short window and push
  Settings out of view. It scrolls.
- **Recording cap** — 45s dropped to 15s. Talking without a clear pause held the
  microphone open with nothing happening, which reads as the companion ignoring you.
- **Orb menu** — `orb:menu` returned `Menu.popup()`, which cannot cross IPC, so
  right-clicking the companion threw.
- **Provider** — Gemini, with a model fallback chain. The bundled OpenRouter key is
  free-tier and fails real requests in a way that looks like the app doing nothing.

Added: `Publish a role` (the Fastn hiring module), `tests/publish-ui.cjs`,
`tests/browser-form.cjs` (fills and submits a real form in Chrome) and
`tests/hireloop.test.cjs`.

All suites pass: 61 unit, companion, voice, coach, context, tasks, desktop, native,
forms, publish-ui, browser-form and the hireloop bridge.
