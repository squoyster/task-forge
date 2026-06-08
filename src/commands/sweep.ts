import { sweepStaleTasks } from "../core/sweeper.js";
import { pullTaskState } from "../core/git.js";
import { inspectTask } from "./inspect.js";
import { logInfo, logSuccess, logSub, logWarn, logError, logDivider } from "../util/logging.js";
import { successResult, failedResult, noopResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown } from "../core/result-renderer.js";
import { resolveAuthority, assertCanForce, ForceRequiresHumanOrDoctorError } from "../core/authority.js";

export interface SweepOptions {
  json?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

export async function cmdSweep(options?: SweepOptions): Promise<void> {
  const startTime = Date.now();
  const json = options?.json ?? false;

  // Force authority check
  if (options?.force) {
    const authority = resolveAuthority();
    try {
      assertCanForce(authority);
    } catch (err) {
      if (err instanceof ForceRequiresHumanOrDoctorError) {
        const nextActions = [
          {
            command: "taskforge doctor --json",
            reason: "Diagnose whether a recovery path exists.",
            safety: "safe" as const,
          },
          {
            command: "taskforge sweep --dry-run",
            reason: "Preview stale tasks without mutating state.",
            safety: "safe" as const,
          },
        ];

        if (json) {
          console.log(JSON.stringify({
            ok: false,
            error: "Normal agents may not use --force.",
            code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
            nextActions,
          }, null, 2));
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

        const result = failedResult({
          command: "sweep",
          error: "Normal agents may not use --force.",
          code: "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
          nextCommands: getValidNextCommands("sweep", "failed"),
          duration: Date.now() - startTime,
        });
        process.stdout.write(renderResultMarkdown(result) + "\n");
        return;
      }
      throw err;
    }
  }

  await pullTaskState();
  const sweepResult = await sweepStaleTasks(undefined, {
    commit: true,
    dryRun: options?.dryRun,
    force: options?.force,
    inspectTask: options?.force ? undefined : inspectTask,
  });

  if (json) {
    const actions = sweepResult.stale.map((s) => ({
      taskId: s.id,
      previousAssignee: s.previousAssignee,
      ageHours: (s.ageMs / (60 * 60 * 1000)).toFixed(1),
      action: s.action,
      reason: s.reason,
    }));
    console.log(JSON.stringify({
      ok: true,
      sweep: {
        scanned: sweepResult.scanned,
        stale: sweepResult.stale.length,
        changed: sweepResult.changed,
        dryRun: sweepResult.dryRun,
        actions,
      },
      nextActions: [
        { command: "taskforge next", reason: "Find the next available task after sweep recovery.", safety: "safe" as const, preferred: true },
      ],
    }, null, 2));
    return;
  }

  if (sweepResult.changed === 0) {
    logInfo("Sweeper: No stale tasks found.");
    logDivider();
    logInfo("Valid next actions:");
    logSub("1. taskforge next");
    logSub("   Reason: Find the next available task.");
    logSub("   Safety: safe");

    const result = noopResult({
      command: "sweep",
      reason: "No stale tasks found.",
      nextCommands: getValidNextCommands("sweep", "noop"),
      duration: Date.now() - startTime,
    });
    process.stdout.write(renderResultMarkdown(result) + "\n");
    return;
  }

  logInfo(`Sweeper: Found ${sweepResult.stale.length} stale task(s)${options?.dryRun ? " (dry-run)" : ""}.`);

  for (const swept of sweepResult.stale) {
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

  let guidance = "";
  if (!sweepResult.pushed) {
    logWarn("Sweeper: failed to push state changes after retries.");
    guidance = "Sweeper: failed to push state changes after retries.";
  } else if (!options?.dryRun) {
    logSuccess(`Sweeper: Recovered ${sweepResult.changed} stale task(s).`);
    guidance = `Sweeper: Recovered ${sweepResult.changed} stale task(s).`;
  } else {
    logInfo(`Sweeper: ${sweepResult.changed} task(s) would be recovered (dry-run).`);
    guidance = `Sweeper: ${sweepResult.changed} task(s) would be recovered (dry-run).`;
  }

  const result = successResult({
    command: "sweep",
    guidance,
    nextCommands: getValidNextCommands("sweep", "success"),
    duration: Date.now() - startTime,
  });
  process.stdout.write(renderResultMarkdown(result) + "\n");
}
