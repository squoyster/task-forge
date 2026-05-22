import { sweepStaleTasks } from "../core/sweeper.js";
import { logInfo, logSuccess, logSub, logWarn } from "../util/logging.js";
import { printJson, jsonOk } from "../util/json-result.js";

export interface SweepOptions {
  json?: boolean;
}

/**
 * CLI command: run the Sweeper Protocol manually.
 * Supports both human-readable and JSON output.
 */
export async function cmdSweep(options?: SweepOptions): Promise<void> {
  const result = await sweepStaleTasks(undefined, { commit: true });

  if (options?.json) {
    printJson(jsonOk({
      sweep: {
        scanned: result.scanned,
        stale: result.stale.length,
        changed: result.changed,
      },
    }));
    return;
  }

  if (result.changed === 0) {
    logInfo("Sweeper: No stale tasks found.");
    return;
  }

  logInfo(`Sweeper: Found ${result.changed} stale task(s) with claims older than 4 hours.`);

  for (const swept of result.stale) {
    const ageHours = (swept.ageMs / (60 * 60 * 1000)).toFixed(1);
    logSub(`Resetting ${swept.id} (claimed by "${swept.previousAssignee}" ${ageHours}h ago)`);
    logSuccess(`  ${swept.id}: In Progress → Ready (claim cleared)`);
  }

  if (!result.pushed) {
    logWarn("Sweeper: failed to push state changes after retries. State changes are committed locally.");
  } else {
    logSuccess(`Sweeper: Recovered ${result.changed} stale task(s).`);
  }
}