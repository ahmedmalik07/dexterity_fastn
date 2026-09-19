"use server";

/**
 * Server action used by the pipeline page.
 *
 * Runs the stage notifier without putting CRON_SECRET anywhere near the browser: the
 * action executes on the server and only returns what was sent.
 */

import { runStageNotifier, type StageRun } from "@/lib/stages";

export async function checkStages(jobId: string): Promise<StageRun> {
  return runStageNotifier(jobId);
}
