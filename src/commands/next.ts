import { loadAllTasks } from "../core/task-store.js";
import { selectNextTask, scoreTask, hasUnmetDependencies } from "../core/scheduler.js";
import { sweepStaleTasks } from "../core/sweeper.js";
import { pullTaskState, checkUncommittedWorktrees } from "../core/git.js";
import { checkOutstandingSessionTasks } from "../core/session.js";
import { isDoctorLocked } from "../core/doctor-lock.js";
import { loadConfig } from "../core/config.js";
import { listPullRequests } from "../integrations/github/service.js";
import { logInfo, logHeader, logSub, logDivider, logWarn } from "../util/logging.js";
import { buildJsonTask } from "../util/json-result.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { STATUS } from "../util/status-constants.js";
import { doctorRequiredResult, blockedResult, successResult, noopResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultJson } from "../core/result-renderer.js";
import { emitResult, type ValidNextCommand, type TaskForgeCommandResult } from "../core/command-result.js";

export interface NextOptions {
  json?: boolean;
}

function getNextTaskCommands(task: { id: string; status: string; worktree?: string }): ValidNextCommand[] {
  // TF-SIMP-04: entering an existing workspace is direct-git (cd <worktree>),
  // and beginning a ready task is `taskforge claim` (worktree creation is direct-git).
  const enterWorkspace = task.worktree
    ? `cd ${task.worktree}`
    : `git worktree add -b <branch> <worktree> main`;

  if (task.status === STATUS.VERIFY) {
    return [
      {
        command: enterWorkspace,
        purpose: "Enter the verification workspace",
        when: "Before running QA or acceptance checks",
        allowedFor: "all",
        priority: 1,
      },
      {
        command: "taskforge gates --json",
        purpose: "Run verification gates",
        when: "After entering the task worktree",
        allowedFor: "all",
        priority: 2,
      },
      {
        command: `taskforge done ${task.id}`,
        purpose: "Mark task done after verification passes",
        when: "Only after gates and acceptance criteria pass",
        allowedFor: "all",
        priority: 3,
      },
    ];
  }

  if (task.status === STATUS.REVIEW) {
    return [
      {
        command: `git diff`,
        purpose: "Review the task changes",
        when: "Before approving or returning work",
        allowedFor: "all",
        priority: 1,
      },
      {
        command: enterWorkspace,
        purpose: "Enter the review workspace if deeper inspection is needed",
        when: "After reviewing task metadata",
        allowedFor: "all",
        priority: 2,
      },
    ];
  }

  if (task.status === STATUS.IN_PROGRESS || task.worktree) {
    return [
      {
        command: enterWorkspace,
        purpose: "Continue the existing task workspace (direct-git)",
        when: "After selecting already-started work",
        allowedFor: "all",
        priority: 1,
      },
      {
        command: `taskforge heartbeat ${task.id}`,
        purpose: "Refresh the task lease",
        when: "Before continuing active work",
        allowedFor: "all",
        priority: 2,
      },
    ];
  }

  return getValidNextCommands("next", "success");
}

function getNextTaskGuidance(task: { id: string; status: string; worktree?: string }): string {
  const enterCmd = task.worktree ? `cd ${task.worktree}` : `git worktree add -b <branch> <worktree> main`;
  if (task.status === STATUS.VERIFY) {
    return `Next task: ${task.id} is in Verify. Run '${enterCmd}' and verify it.`;
  }
  if (task.status === STATUS.REVIEW) {
    return `Next task: ${task.id} is in Review. Run 'git diff' or '${enterCmd}' to review it.`;
  }
  if (task.status === STATUS.IN_PROGRESS) {
    return `Next task: ${task.id} is already In Progress. Run '${enterCmd}' to continue.`;
  }
  return `Next task: ${task.id}. Run 'taskforge claim ${task.id}' to claim it, then create your worktree via direct git.`;
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
      emitResult(result, true);
      return;
    }
    emitResult(result, false);
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
      emitResult(result, true);
      return;
    }
    emitResult(result, false);
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
      emitResult(result, true);
      return;
    }
    logInfo("No task files found.");
    emitResult(result, false);
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
      emitResult(result, true);
      return;
    }
    emitResult(result, false);
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
      emitResult(result, true);
      return;
    }
    logInfo("No actionable tasks found.");
    logDivider();
    logInfo("All tasks are in Inbox, Needs Spec, Blocked, Done, Rejected, Deferred, or blocked by dependencies.");
    emitResult(result, false);
    return;
  }

  // Check for open PRs that haven't been approved
  const config = loadConfig(repoRoot);
  if (config.github?.enabled && config.github.owner && config.github.repo) {
    const openPRs = await listPullRequests();
    const agentBranches = openPRs.filter((pr) => pr.headRefName.startsWith("agent/"));
    if (agentBranches.length > 0) {
      const prList = agentBranches
        .map((pr) => `  #${pr.number}: ${pr.title}${pr.draft ? " (draft)" : ""}`)
        .join("\n");
      const guidance =
        `There are ${agentBranches.length} open agent PR(s) awaiting review:\n${prList}\n\n` +
        `Request human approval before continuing with auto-continuation. ` +
        `Use 'gh pr view ${agentBranches[0].number}' to check details.`;
      logWarn(guidance);
    }
  }

  // Happy path — task selected
  const unmet = hasUnmetDependencies(next, tasks);
  const result = successResult({
    command: "next",
    taskId: next.id,
    guidance: getNextTaskGuidance(next),
    nextCommands: getNextTaskCommands(next),
    duration: Date.now() - startTime,
  });

  if (options?.json) {
    const jsonOutput = JSON.parse(renderResultJson(result)) as Record<string, unknown>;
    jsonOutput.task = buildJsonTask(next);
    jsonOutput.score = scoreTask(next);
    // TF-SIMP-05: complete packet — sufficient to select, claim, set up the
    // worktree, load the prompt, and recognize safety constraints.
    jsonOutput.owner = next.assignee ?? null;
    jsonOutput.cwd = next.worktree ?? repoRoot;
    jsonOutput.prompt = `taskforge prompt ${next.id}`;
    // Always surface workspace expectations, even before a worktree exists.
    jsonOutput.workspace = {
      worktree: next.worktree ?? getWorktreePath(repoRoot, next.id),
      branch: next.branch ?? null,
      exists: Boolean(next.worktree),
    };
    if (unmet.length > 0) {
      jsonOutput.waitingOn = unmet;
    }
    // Route through emitResult so the MCP sink captures the enriched packet.
    // jsonOutput is `result` plus agent-facing enrichment keys (task/score/
    // owner/cwd/prompt/workspace); it is a structural superset of the result.
    emitResult(jsonOutput as TaskForgeCommandResult, true);
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
  emitResult(result, false);
}
