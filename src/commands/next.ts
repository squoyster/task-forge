import { loadAllTasks } from "../core/task-store.js";
import { selectNextTask, scoreTask, hasUnmetDependencies } from "../core/scheduler.js";
import { sweepStaleTasks } from "../core/sweeper.js";
import { pullTaskState, checkUncommittedWorktrees } from "../core/git.js";
import { checkOutstandingSessionTasks } from "../core/session.js";
import { isDoctorLocked } from "../core/doctor-lock.js";
import { nextStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";
import { logInfo, logHeader, logSub, logDivider, logWarn } from "../util/logging.js";
import { printJson, jsonOk, jsonError, buildJsonTask } from "../util/json-result.js";
import { getRepoRoot } from "../util/paths.js";
import { doctorRequiredResult, blockedResult, successResult, noopResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";

export interface NextOptions {
  json?: boolean;
}

export async function cmdNext(options?: NextOptions): Promise<void> {
  const startTime = Date.now();
  // Pull latest task-state before reading
  await pullTaskState();

  // Run sweeper before selecting next task
  await sweepStaleTasks(undefined, { commit: true });

  // Reload tasks after sweeping
  const tasks = loadAllTasks();
  const repoRoot = getRepoRoot();

  // Doctor-lock: refuse if system is in recovery
  const lock = isDoctorLocked();
  if (lock.locked) {
    const result = doctorRequiredResult({
      command: "next",
      reason: lock.reason ?? "System is in recovery mode",
      nextCommands: getValidNextCommands("next", "failed"),
      duration: Date.now() - startTime,
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(result) + "\n");
      return;
    }
    process.stdout.write(renderResultMarkdown(result) + "\n");
    return;
  }

  // Hard guardrail: check outstanding session tasks
  const outstandingTask = await checkOutstandingSessionTasks(tasks, repoRoot);
  if (outstandingTask) {
    const result = blockedResult({
      command: "next",
      reason: `You have an outstanding task: ${outstandingTask}. Complete or release it before starting new work.`,
      nextCommands: getValidNextCommands("next", "failed"),
      duration: Date.now() - startTime,
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(result) + "\n");
      return;
    }
    process.stdout.write(renderResultMarkdown(result) + "\n");
    return;
  }

  if (tasks.length === 0) {
    const result = noopResult({
      command: "next",
      reason: "No task files found.",
      nextCommands: getValidNextCommands("next", "noop"),
      duration: Date.now() - startTime,
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(result) + "\n");
      return;
    }
    logInfo("No task files found.");
    process.stdout.write(renderResultMarkdown(result) + "\n");
    return;
  }

  // Check for uncommitted worktrees
  const uncommittedWorktrees = await checkUncommittedWorktrees(repoRoot, tasks);

  if (uncommittedWorktrees.length > 0) {
    const dirty = uncommittedWorktrees[0];
    const result = blockedResult({
      command: "next",
      reason: `Task ${dirty.taskId} has uncommitted changes. Commit or complete it first.`,
      nextCommands: getValidNextCommands("next", "failed"),
      duration: Date.now() - startTime,
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(result) + "\n");
      return;
    }
    process.stdout.write(renderResultMarkdown(result) + "\n");
    return;
  }

  const next = selectNextTask(tasks);

  if (!next) {
    const result = noopResult({
      command: "next",
      reason: "No actionable tasks found.",
      nextCommands: getValidNextCommands("next", "noop"),
      duration: Date.now() - startTime,
    });
    if (options?.json) {
      process.stdout.write(renderResultJson(result) + "\n");
      return;
    }
    logInfo("No actionable tasks found.");
    logDivider();
    logInfo("All tasks are in Inbox, Needs Spec, Blocked, Done, Rejected, Deferred, or blocked by dependencies.");
    process.stdout.write(renderResultMarkdown(result) + "\n");
    return;
  }

  // Happy path — task selected
  const unmet = hasUnmetDependencies(next, tasks);
  const result = successResult({
    command: "next",
    taskId: next.id,
    guidance: `Next task: ${next.id}. Run 'taskforge start ${next.id}' to begin.`,
    nextCommands: getValidNextCommands("next", "success"),
    duration: Date.now() - startTime,
  });

  if (options?.json) {
    const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
    jsonOutput.task = buildJsonTask(next);
    jsonOutput.score = scoreTask(next);
    if (unmet.length > 0) {
      jsonOutput.waitingOn = unmet;
    }
    if (next.worktree || next.branch) {
      jsonOutput.workspace = {
        worktree: next.worktree,
        branch: next.branch,
      };
    }
    process.stdout.write(JSON.stringify(jsonOutput, null, 2) + "\n");
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

  // Show existing worktree if the task was previously started
  if (next.worktree) {
    logSub(`**Worktree:** ${next.worktree}`);
    logSub(`**Branch:** ${next.branch ?? "none"}`);
  }

  logDivider();
  process.stdout.write(renderResultMarkdown(result) + "\n");
}