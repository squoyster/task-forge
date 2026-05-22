import { sweepStaleTasks } from "../core/sweeper.js";
import { pullTaskState } from "../core/git.js";
import { inspectTask } from "./inspect.js";
import { logInfo, logSuccess, logSub, logWarn } from "../util/logging.js";
import { printJson, jsonOk } from "../util/json-result.js";

export interface SweepOptions {
  json?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

export async function cmdSweep(options?: SweepOptions): Promise<void> {
  await pullTaskState();
  const result = await sweepStaleTasks(undefined, {
    commit: true,
    dryRun: options?.dryRun,
    force: options?.force,
    inspectTask: options?.force ? undefined : inspectTask,
  });

  if (options?.json) {
    const actions = result.stale.map((s) => ({
      taskId: s.id,
      previousAssignee: s.previousAssignee,
      ageHours: (s.ageMs / (60 * 60 * 1000)).toFixed(1),
      action: s.action,
      reason: s.reason,
    }));
    printJson(jsonOk({
      sweep: {
        scanned: result.scanned,
        stale: result.stale.length,
        changed: result.changed,
        dryRun: result.dryRun,
        actions,
      },
    }));
    return;
  }

  if (result.changed === 0) {
    logInfo("Sweeper: No stale tasks found.");
    return;
  }

  logInfo(`Sweeper: Found ${result.stale.length} stale task(s)${options?.dryRun ? " (dry-run)" : ""}.`);

  for (const swept of result.stale) {
    const ageHours = (swept.ageMs / (60 * 60 * 1000)).toFixed(1);
    const actionLabel = swept.action === "review" ? "→ Review" : swept.action === "skipped" ? "— SKIPPED" : "→ Ready";
    logSub(`${swept.id} (claimed by "${swept.previousAssignee}" ${ageHours}h ago) ${actionLabel}`);
    if (swept.reason) {
      logWarn(`  ${swept.reason}`);
    }
    if (swept.action !== "skipped") {
      logSuccess(`  ${swept.id}: In Progress → ${swept.action === "review" ? "Review" : "Ready"}`);
    }
  }

  if (!result.pushed) {
    logWarn("Sweeper: failed to push state changes after retries.");
  } else if (!options?.dryRun) {
    logSuccess(`Sweeper: Recovered ${result.changed} stale task(s).`);
  } else {
    logInfo(`Sweeper: ${result.changed} task(s) would be recovered (dry-run).`);
  }
}
