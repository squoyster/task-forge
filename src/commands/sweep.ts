import { sweepStaleTasks } from "../core/sweeper.js";
import { pullTaskState } from "../core/git.js";
import { inspectTask } from "./inspect.js";
import { logInfo, logSuccess, logSub, logWarn, logError, logDivider } from "../util/logging.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { resolveAuthority, assertCanForce, getForceRejectionNextActions, ForceRequiresHumanOrDoctorError } from "../core/authority.js";

export interface SweepOptions {
  json?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

export async function cmdSweep(options?: SweepOptions): Promise<void> {
  // Force authority check
  if (options?.force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        if (options?.json) {
          const nextCommands = getForceRejectionNextActions().map(a => ({
            command: a.command,
            purpose: a.reason,
            when: a.reason,
            allowedFor: (a.safety === "safe" ? "all" : a.safety === "requires_human" ? "human" : "doctor") as "all" | "human" | "doctor",
            priority: a.preferred ? 1 : 2,
          }));
          writeResult(failedResult({
            command: "sweep",
            error: "Normal agents may not use --force.",
            code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
            nextCommands,
          }), options.json);
          return;
        }
        logError("Normal agents may not use --force.");
        logDivider();
        logInfo("Valid next actions:");
        logSub("1. taskforge doctor --json");
        logSub("   Reason: Diagnose whether a recovery path exists.");
        logSub("   Safety: safe");
        logSub("2. taskforge sweep --dry-run");
        logSub("   Reason: Preview stale tasks without mutating state.");
        logSub("   Safety: safe");
        return;
      }
      throw err;
    }
  }

  await pullTaskState();
  const result = await sweepStaleTasks(undefined, {
    commit: true,
    dryRun: options?.dryRun,
    force: options?.force,
    inspectTask: options?.force ? undefined : inspectTask,
  });

  if (options?.json) {
    writeResult(successResult({
      command: "sweep",
      guidance: `Sweeper: Found ${result.stale.length} stale task(s), changed ${result.changed}.`,
      nextCommands: [
        { command: "taskforge next", purpose: "Find the next available task after sweep recovery.", when: "Find the next available task after sweep recovery.", allowedFor: "all", priority: 1 },
      ],
    }), options.json);
    return;
  }

  if (result.changed === 0) {
    logInfo("Sweeper: No stale tasks found.");
    logDivider();
    logInfo("Valid next actions:");
    logSub("1. taskforge next");
    logSub("   Reason: Find the next available task.");
    logSub("   Safety: safe");
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
