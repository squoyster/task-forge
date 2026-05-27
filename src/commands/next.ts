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

export interface NextOptions {
  json?: boolean;
}

export async function cmdNext(options?: NextOptions): Promise<void> {
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
    const result = nextStateMachine({
      hasTasks: tasks.length > 0,
      hasActionableTask: false,
      hasOutstandingTask: false,
      doctorLocked: true,
      doctorReason: lock.reason,
      uncommittedWorktrees: [],
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      printJson(jsonError(
        result.guidance,
        result.errorCode ?? "DOCTOR_LOCKED",
        { nextActions: [result.nextAction], guidance: result.guidance },
      ));
      return;
    }
    logWarn(result.guidance);
    return;
  }

  // Hard guardrail: check outstanding session tasks
  const outstandingTask = await checkOutstandingSessionTasks(tasks, repoRoot);
  if (outstandingTask) {
    const result = nextStateMachine({
      hasTasks: tasks.length > 0,
      hasActionableTask: false,
      hasOutstandingTask: true,
      outstandingTaskId: outstandingTask,
      doctorLocked: false,
      uncommittedWorktrees: [],
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      printJson(jsonError(
        result.guidance,
        result.errorCode ?? "OUTSTANDING_TASK",
        { nextActions: [result.nextAction], guidance: result.guidance },
      ));
      return;
    }
    logWarn(result.guidance);
    return;
  }

  if (tasks.length === 0) {
    const result = nextStateMachine({
      hasTasks: false,
      hasActionableTask: false,
      hasOutstandingTask: false,
      doctorLocked: false,
      uncommittedWorktrees: [],
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      printJson(jsonError("No task files found.", "NO_TASKS", {
        nextActions: [result.nextAction],
        guidance: result.guidance,
      }));
      return;
    }
    logInfo("No task files found.");
    return;
  }

  // Check for uncommitted worktrees
  const uncommittedWorktrees = await checkUncommittedWorktrees(repoRoot, tasks);

  if (uncommittedWorktrees.length > 0) {
    const dirty = uncommittedWorktrees[0];
    const result = nextStateMachine({
      hasTasks: true,
      hasActionableTask: false,
      hasOutstandingTask: false,
      doctorLocked: false,
      uncommittedWorktrees: [{
        taskId: dirty.taskId,
        status: dirty.status,
        dirtyFiles: dirty.dirtyFiles,
      }],
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      printJson(jsonError(
        result.guidance,
        result.errorCode ?? "UNCOMMITTED_CHANGES",
        { nextActions: [result.nextAction], guidance: result.guidance },
      ));
      return;
    }
    logWarn(result.guidance);
    return;
  }

  const next = selectNextTask(tasks);

  if (!next) {
    const result = nextStateMachine({
      hasTasks: true,
      hasActionableTask: false,
      hasOutstandingTask: false,
      doctorLocked: false,
      uncommittedWorktrees: [],
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (options?.json) {
      printJson(jsonError("No actionable tasks found.", "NO_ACTIONABLE_TASKS", {
        nextActions: [result.nextAction],
        guidance: result.guidance,
      }));
      return;
    }
    logInfo("No actionable tasks found.");
    logDivider();
    logInfo("All tasks are in Inbox, Needs Spec, Blocked, Done, Rejected, Deferred, or blocked by dependencies.");
    return;
  }

  // Happy path — task selected
  const unmet = hasUnmetDependencies(next, tasks);
  const result = nextStateMachine({
    hasTasks: true,
    hasActionableTask: true,
    hasOutstandingTask: false,
    doctorLocked: false,
    uncommittedWorktrees: [],
    selectedTaskId: next.id,
    selectedTaskDependsOn: next.dependsOn,
    unmetDependencies: unmet.length > 0 ? unmet : undefined,
  });
  getDefaultGuidanceAdapter().pushGuidance(result);

  if (options?.json) {
    const jsonResult: Record<string, unknown> = {
      ok: true,
      task: buildJsonTask(next),
      score: scoreTask(next),
      nextActions: [result.nextAction],
      guidance: result.guidance,
    };
    if (unmet.length > 0) {
      jsonResult.waitingOn = unmet;
    }
    if (next.worktree || next.branch) {
      jsonResult.workspace = {
        worktree: next.worktree,
        branch: next.branch,
      };
    }
    printJson(jsonResult as unknown as ReturnType<typeof jsonOk>);
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
  logInfo(result.guidance);
}