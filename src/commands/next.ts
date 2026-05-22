import { loadAllTasks } from "../core/task-store.js";
import { selectNextTask, scoreTask, hasUnmetDependencies } from "../core/scheduler.js";
import { sweepStaleTasks } from "../core/sweeper.js";
import { logInfo, logHeader, logSub, logDivider } from "../util/logging.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";

export interface NextOptions {
  json?: boolean;
}

export async function cmdNext(options?: NextOptions): Promise<void> {
  // Run sweeper before selecting next task
  await sweepStaleTasks(undefined, { commit: true });

  // Reload tasks after sweeping
  const tasks = loadAllTasks();

  if (tasks.length === 0) {
    if (options?.json) {
      printJson(jsonError("No task files found.", "NO_TASKS"));
      return;
    }
    logInfo("No task files found.");
    return;
  }

  const next = selectNextTask(tasks);

  if (!next) {
    if (options?.json) {
      printJson(jsonError("No actionable tasks found.", "NO_ACTIONABLE_TASKS"));
      return;
    }
    logInfo("No actionable tasks found.");
    logDivider();
    logInfo("All tasks are in Inbox, Needs Spec, Blocked, Done, Rejected, Deferred, or blocked by dependencies.");
    return;
  }

  if (options?.json) {
    const unmet = hasUnmetDependencies(next, tasks);
    const result: Record<string, unknown> = {
      ok: true,
      task: buildJsonTask(next),
      score: scoreTask(next),
    };
    if (unmet.length > 0) {
      result.waitingOn = unmet;
    }
    printJson(result as unknown as ReturnType<typeof jsonOk>);
    return;
  }

  logHeader(`## Next Task`);
  logDivider();
  logSub(`**ID:** ${next.id}`);
  logSub(`**Status:** ${next.status}`);
  logSub(`**Priority:** ${next.priority}`);
  logSub(`**Agent Role:** ${next.agentRole ?? "Implementer"}`);
  logSub(`**Score:** ${scoreTask(next)}`);

  // Show dependency info
  const unmet = hasUnmetDependencies(next, tasks);
  if (unmet.length > 0) {
    logSub(`**Waiting on:** ${unmet.join(", ")}`);
  }

  // Show who depends on this task
  const dependents = tasks.filter(
    (t) => t.dependsOn && t.dependsOn.includes(next.id),
  );
  if (dependents.length > 0) {
    logSub(`**Blocks:** ${dependents.map((d) => d.id).join(", ")}`);
  }

  // Extract goal from body
  const goalMatch = next.body.match(/## Goal\n([\s\S]*?)(?=##|\n\n\n|$)/);
  if (goalMatch) {
    logSub(`**Goal:** ${goalMatch[1].trim().slice(0, 120)}${goalMatch[1].trim().length > 120 ? "..." : ""}`);
  }

  logSub(`**File:** ${next.filePath}`);
  logDivider();
  logInfo(`### Start this task:`);
  logSub(`taskforge start ${next.id}`);
}