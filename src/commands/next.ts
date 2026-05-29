import { loadAllTasks } from "../core/task-store.js";
import { selectNextTask, scoreTask, hasUnmetDependencies } from "../core/scheduler.js";
import { sweepStaleTasks } from "../core/sweeper.js";
import { pullTaskState, checkUncommittedWorktrees } from "../core/git.js";
import { checkOutstandingSessionTasks } from "../core/session.js";
import { isDoctorLocked } from "../core/doctor-lock.js";
import { nextStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";
import { logInfo, logHeader, logSub, logDivider, logWarn } from "../util/logging.js";
import { getRepoRoot } from "../util/paths.js";
import { failedResult, successResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";

export interface NextOptions {
  json?: boolean;
}

export async function cmdNext(options?: NextOptions): Promise<void> {
  const startTime = Date.now();
  const json = options?.json ?? false;

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
    const stateResult = nextStateMachine({
      hasTasks: tasks.length > 0,
      hasActionableTask: false,
      hasOutstandingTask: false,
      doctorLocked: true,
      doctorReason: lock.reason,
      uncommittedWorktrees: [],
    });
    getDefaultGuidanceAdapter().pushGuidance(stateResult);

    const result = failedResult({
      command: "next",
      error: stateResult.guidance,
      code: stateResult.errorCode ?? "DOCTOR_LOCKED",
      nextCommands: getValidNextCommands("next", "failed"),
      guidance: json ? stateResult.guidance : undefined,
      duration: Date.now() - startTime,
    });

    if (json) {
      const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
      jsonOutput.nextActions = [stateResult.nextAction];
      jsonOutput.guidance = stateResult.guidance;
      console.log(JSON.stringify(jsonOutput, null, 2));
    } else {
      logWarn(stateResult.guidance);
      process.stdout.write(renderResultMarkdown(result) + "\n");
    }
    return;
  }

  // Hard guardrail: check outstanding session tasks
  const outstandingTask = await checkOutstandingSessionTasks(tasks, repoRoot);
  if (outstandingTask) {
    const stateResult = nextStateMachine({
      hasTasks: tasks.length > 0,
      hasActionableTask: false,
      hasOutstandingTask: true,
      outstandingTaskId: outstandingTask,
      doctorLocked: false,
      uncommittedWorktrees: [],
    });
    getDefaultGuidanceAdapter().pushGuidance(stateResult);

    const result = failedResult({
      command: "next",
      error: stateResult.guidance,
      code: stateResult.errorCode ?? "OUTSTANDING_TASK",
      nextCommands: getValidNextCommands("next", "failed"),
      guidance: json ? stateResult.guidance : undefined,
      duration: Date.now() - startTime,
    });

    if (json) {
      const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
      jsonOutput.nextActions = [stateResult.nextAction];
      jsonOutput.guidance = stateResult.guidance;
      console.log(JSON.stringify(jsonOutput, null, 2));
    } else {
      logWarn(stateResult.guidance);
      process.stdout.write(renderResultMarkdown(result) + "\n");
    }
    return;
  }

  if (tasks.length === 0) {
    const stateResult = nextStateMachine({
      hasTasks: false,
      hasActionableTask: false,
      hasOutstandingTask: false,
      doctorLocked: false,
      uncommittedWorktrees: [],
    });
    getDefaultGuidanceAdapter().pushGuidance(stateResult);

    const result = failedResult({
      command: "next",
      error: "No task files found.",
      code: "NO_TASKS",
      nextCommands: getValidNextCommands("next", "failed"),
      guidance: json ? stateResult.guidance : undefined,
      duration: Date.now() - startTime,
    });

    if (json) {
      const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
      jsonOutput.nextActions = [stateResult.nextAction];
      jsonOutput.guidance = stateResult.guidance;
      console.log(JSON.stringify(jsonOutput, null, 2));
    } else {
      logInfo("No task files found.");
      process.stdout.write(renderResultMarkdown(result) + "\n");
    }
    return;
  }

  // Check for uncommitted worktrees
  const uncommittedWorktrees = await checkUncommittedWorktrees(repoRoot, tasks);

  if (uncommittedWorktrees.length > 0) {
    const dirty = uncommittedWorktrees[0];
    const stateResult = nextStateMachine({
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
    getDefaultGuidanceAdapter().pushGuidance(stateResult);

    const result = failedResult({
      command: "next",
      error: stateResult.guidance,
      code: stateResult.errorCode ?? "UNCOMMITTED_CHANGES",
      nextCommands: getValidNextCommands("next", "failed"),
      guidance: json ? stateResult.guidance : undefined,
      duration: Date.now() - startTime,
    });

    if (json) {
      const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
      jsonOutput.nextActions = [stateResult.nextAction];
      jsonOutput.guidance = stateResult.guidance;
      console.log(JSON.stringify(jsonOutput, null, 2));
    } else {
      logWarn(stateResult.guidance);
      process.stdout.write(renderResultMarkdown(result) + "\n");
    }
    return;
  }

  const next = selectNextTask(tasks);

  if (!next) {
    const stateResult = nextStateMachine({
      hasTasks: true,
      hasActionableTask: false,
      hasOutstandingTask: false,
      doctorLocked: false,
      uncommittedWorktrees: [],
    });
    getDefaultGuidanceAdapter().pushGuidance(stateResult);

    const result = failedResult({
      command: "next",
      error: "No actionable tasks found.",
      code: "NO_ACTIONABLE_TASKS",
      nextCommands: getValidNextCommands("next", "failed"),
      guidance: json ? stateResult.guidance : undefined,
      duration: Date.now() - startTime,
    });

    if (json) {
      const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
      jsonOutput.nextActions = [stateResult.nextAction];
      jsonOutput.guidance = stateResult.guidance;
      console.log(JSON.stringify(jsonOutput, null, 2));
    } else {
      logInfo("No actionable tasks found.");
      logDivider();
      logInfo("All tasks are in Inbox, Needs Spec, Blocked, Done, Rejected, Deferred, or blocked by dependencies.");
      process.stdout.write(renderResultMarkdown(result) + "\n");
    }
    return;
  }

  // Happy path — task selected
  const unmet = hasUnmetDependencies(next, tasks);
  const stateResult = nextStateMachine({
    hasTasks: true,
    hasActionableTask: true,
    hasOutstandingTask: false,
    doctorLocked: false,
    uncommittedWorktrees: [],
    selectedTaskId: next.id,
    selectedTaskDependsOn: next.dependsOn,
    unmetDependencies: unmet.length > 0 ? unmet : undefined,
  });
  getDefaultGuidanceAdapter().pushGuidance(stateResult);

  const result = successResult({
    command: "next",
    guidance: json ? stateResult.guidance : undefined,
    nextCommands: getValidNextCommands("next", "success"),
    duration: Date.now() - startTime,
  });

  if (json) {
    const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
    jsonOutput.task = {
      id: next.id,
      title: next.body.match(/^#\s+\S+:\s+(.+)$/m)?.[1] ?? next.id,
      status: next.status,
      priority: next.priority,
      agentRole: next.agentRole ?? "Implementer",
      file: next.filePath,
    };
    jsonOutput.score = scoreTask(next);
    jsonOutput.nextActions = [stateResult.nextAction];
    jsonOutput.guidance = stateResult.guidance;
    if (unmet.length > 0) {
      jsonOutput.waitingOn = unmet;
    }
    if (next.worktree || next.branch) {
      jsonOutput.workspace = {
        worktree: next.worktree,
        branch: next.branch,
      };
    }
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
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
    logInfo(stateResult.guidance);
    process.stdout.write(renderResultMarkdown(result) + "\n");
  }
}