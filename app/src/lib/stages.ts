/**
 * Stage emails.
 *
 * Reads the Candidates board through Fastn and emails anyone whose Stage has moved since
 * the last run, then writes the new stage back through Fastn so an email is never sent
 * twice for the same move.
 *
 * Two callers share this: the Vercel cron job, and the pipeline page, which watches for
 * changes while an HR person has it open. The free Vercel plan only allows a daily cron,
 * so the page is what makes "drag a card, the candidate hears about it" work live.
 */

import { channelStep } from "./fastn";
import { queryCandidates, readCandidate, setLastNotifiedStage } from "./notion";
import { sendEmail } from "./channels";
import { emailForStage, type Stage } from "./emails";
import { loadJob } from "./jobs";

const NOTIFIABLE: Stage[] = ["Shortlisted", "Interview", "Offer", "Rejected"];

export type StageEmail = {
  name: string;
  stage: string;
  ok: boolean;
  error?: string;
};

export type StageRun = {
  ok: boolean;
  checked: number;
  sent: StageEmail[];
  error?: string;
};

export async function runStageNotifier(jobId?: string): Promise<StageRun> {
  const query = await queryCandidates();
  if (!query.ok || !query.data) {
    return { ok: false, checked: 0, sent: [], error: query.error ?? "Could not read the board" };
  }

  const rows = query.data.results ?? [];
  const sent: StageEmail[] = [];

  for (const page of rows) {
    const candidate = readCandidate(page);
    if (jobId && candidate.jobId !== jobId) continue;

    const stageChanged = candidate.stage !== candidate.lastNotifiedStage;
    const worthEmailing = NOTIFIABLE.includes(candidate.stage as Stage);
    if (!stageChanged || !worthEmailing || !candidate.email) continue;

    const job = await loadJob(candidate.jobId);
    const template = emailForStage(candidate.stage as Stage, candidate.name, job?.title ?? "the role");
    if (!template) continue;

    const mail = await channelStep("email", () =>
      sendEmail(candidate.email, template.subject, template.body),
    );

    // Record the stage only once the email is actually away, so a failure retries.
    if (mail.ok) {
      const saved = await setLastNotifiedStage(candidate.pageId, candidate.stage);
      if (!saved.ok) {
        sent.push({
          name: candidate.name,
          stage: candidate.stage,
          ok: false,
          error: "Email sent, but the board could not be updated — it may send again",
        });
        continue;
      }
    }

    sent.push({ name: candidate.name, stage: candidate.stage, ok: mail.ok, error: mail.error });
  }

  return { ok: true, checked: jobId ? sent.length : rows.length, sent };
}
