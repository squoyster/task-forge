import { loadTaskById, updateTaskStatus, clearTaskLock, appendAgentNote, parseTaskFile, writeTaskFile, hasAcceptanceCriteriaSection, hasBlankAcceptanceCriteria, hasUncheckedAcceptanceCriteria } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { removeWorktree, removeBranch, getWorktreeDirtyFiles, getBranchCommitsAhead } from "../core/git.js";
import { withTaskStateTransaction } from "../core/task-state-transaction.js";
import { STATUS } from "../util/status-constants.js";
import { logSuccess, logInfo, logWarn, logSub, logHeader, logDivider, logError } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError, MissingAcceptanceCriteriaError, BlankAcceptanceCriteriaError, UncheckedAcceptanceCriteriaError } from "../core/errors.js";
import { getRepoRoot } from "../util/paths.js";
import { assertTaskOwnership } from "../core/session.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult as buildSuccessResult, failedResult } from "../core/result-builder.js";
import { createTaskEvent, appendTaskTranscript } from "../core/audit.js";
import { runGates } from "./gates.js";
import { isDoctorLocked, removeDoctorLock } from "../core/doctor-lock.js";
import { hashControlFiles } from "../core/control-files.js";
import { doneStateMachine } from "../core/command-states.js";
import { getDefaultGuidanceAdapter } from "../core/guidance-adapter.js";
import { removeSessionState } from "../core/session-state.js";
import { markAgentIdle } from "../core/agent-registry.js";
import { checkCompletionEligibility } from "../core/completion-policy.js";
import { GitHubPullRequestVerifier } from "../core/pr-verifier.js";
import { loadConfig } from "../core/config.js";
import type { ParsedTask } from "../core/task-store.js";

export interface DoneOptions {
  cleanup?: boolean;
  deleteBranch?: boolean;
  json?: boolean;
}

function mapNextAction(action: string): { command: string; purpose: string; when: string; allowedFor: "all" | "human" | "doctor" | "agent"; priority: number } {
  switch (action) {
    case "request_human_input":
      return { command: "block", purpose: "Request human input to resolve", when: "needs:human", allowedFor: "human", priority: 3 };
    case "work_on_task":
      return { command: "checkpoint", purpose: "Commit changes and retry", when: "worktree:modified", allowedFor: "agent", priority: 2 };
    case "none":
    default:
      return { command: "next", purpose: "Find the next available task", when: "task:done", allowedFor: "all", priority: 1 };
  }
}

export async function cmdDone(
  taskId: string,
  options: DoneOptions = {},
): Promise<void> {
  const { cleanup = false, deleteBranch = false, json = false } = options;
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    const result = doneStateMachine({
      validTransition: false,
      gatesPassed: false,
      ownershipMatch: false,
      worktreeClean: false,
      branchPushed: false,
      controlFileHashMatch: false,
      hasAcSection: false,
      hasBlankAc: false,
      hasUncheckedAc: false,
      taskId,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "TASK_NOT_FOUND", nextCommands: [mapNextAction(result.nextAction)] }), json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  // --- Check gates ---
  const { passed: gatesPassed, results: gateResults } = await runGates();
  if (!json) {
    logHeader("# TaskForge Gates");
    logDivider();
    for (const r of gateResults) {
      if (r.passed) {
        logSuccess(`✓ ${r.name} (${r.duration.toFixed(0)}ms): ${r.command}`);
      } else {
        logError(`✗ ${r.name} (${r.duration.toFixed(0)}ms): ${r.command}`);
      }
    }
    logDivider();
    if (gatesPassed) {
      logSuccess(`All ${gateResults.length} gate(s) passed.`);
    } else {
      const failedCount = gateResults.filter((r) => !r.passed).length;
      logError(`${failedCount}/${gateResults.length} gate(s) failed.`);
    }
  }
  if (!gatesPassed) {
    const result = doneStateMachine({
      validTransition: true,
      gatesPassed: false,
      ownershipMatch: true,
      worktreeClean: true,
      branchPushed: true,
      controlFileHashMatch: true,
      hasAcSection: true,
      hasBlankAc: false,
      hasUncheckedAc: false,
      taskId,
      currentStatus: task.status,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "GATES_FAILED" }), json);
      return;
    }
    throw new Error(result.guidance);
  }

  // --- Status transition ---
  const transitionError = validateTransition(task.status, STATUS.DONE);
  if (transitionError) {
    const result = doneStateMachine({
      validTransition: false,
      gatesPassed: true,
      ownershipMatch: true,
      worktreeClean: true,
      branchPushed: true,
      controlFileHashMatch: true,
      hasAcSection: true,
      hasBlankAc: false,
      hasUncheckedAc: false,
      taskId,
      currentStatus: task.status,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "INVALID_TRANSITION", nextCommands: [mapNextAction(result.nextAction)] }), json);
      return;
    }
    throw new InvalidStatusTransitionError(
      task.status,
      STATUS.DONE,
      [STATUS.REVIEW, STATUS.VERIFY],
    );
  }

  // Assert ownership if task is locked (skip if no lock set)
  if (task.assignee) {
    try {
      await assertTaskOwnership(task, repoRoot);
    } catch {
      const result = doneStateMachine({
        validTransition: true,
        gatesPassed: true,
        ownershipMatch: false,
        worktreeClean: true,
        branchPushed: true,
        controlFileHashMatch: true,
        hasAcSection: true,
        hasBlankAc: false,
        hasUncheckedAc: false,
        taskId,
        currentStatus: task.status,
      });
      getDefaultGuidanceAdapter().pushGuidance(result);
      if (json) {
        writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "OWNERSHIP_MISMATCH", nextCommands: [mapNextAction(result.nextAction)] }), json);
        return;
      }
      throw new Error(result.guidance);
    }
  }

  // Worktree dirty check
  if (task.worktree) {
    const dirtyFiles = await getWorktreeDirtyFiles(task.worktree);
    if (dirtyFiles.length > 0) {
      const result = doneStateMachine({
        validTransition: true,
        gatesPassed: true,
        ownershipMatch: true,
        worktreeClean: false,
        branchPushed: true,
        controlFileHashMatch: true,
        hasAcSection: true,
        hasBlankAc: false,
        hasUncheckedAc: false,
        dirtyFiles,
        taskId,
        currentStatus: task.status,
      });
      getDefaultGuidanceAdapter().pushGuidance(result);
      if (json) {
        writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "WORKTREE_DIRTY", nextCommands: [mapNextAction(result.nextAction)] }), json);
        return;
      }
      throw new Error(result.guidance);
    }
  }

  // Branch unpushed check
  if (task.branch) {
    const commitsAhead = await getBranchCommitsAhead(repoRoot, task.branch);
    if (commitsAhead > 0) {
      const result = doneStateMachine({
        validTransition: true,
        gatesPassed: true,
        ownershipMatch: true,
        worktreeClean: true,
        branchPushed: false,
        controlFileHashMatch: true,
        hasAcSection: true,
        hasBlankAc: false,
        hasUncheckedAc: false,
        commitsAhead,
        taskId,
        currentStatus: task.status,
      });
      getDefaultGuidanceAdapter().pushGuidance(result);
      if (json) {
        writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "BRANCH_UNPUSHED", nextCommands: [mapNextAction(result.nextAction)] }), json);
        return;
      }
      throw new Error(result.guidance);
    }
  }

  // Control-file change detection
  if (task.context_hash) {
    const currentHash = hashControlFiles(repoRoot);
    if (currentHash !== task.context_hash) {
      const result = doneStateMachine({
        validTransition: true,
        gatesPassed: true,
        ownershipMatch: true,
        worktreeClean: true,
        branchPushed: true,
        controlFileHashMatch: false,
        hasAcSection: true,
        hasBlankAc: false,
        hasUncheckedAc: false,
        taskId,
        currentStatus: task.status,
      });
      getDefaultGuidanceAdapter().pushGuidance(result);
      if (json) {
        writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "CONTEXT_CHANGED", nextCommands: [mapNextAction(result.nextAction)] }), json);
        return;
      }
      throw new Error(result.guidance);
    }
  }

  // Acceptance Criteria section check
  if (!hasAcceptanceCriteriaSection(task.body)) {
    const result = doneStateMachine({
      validTransition: true,
      gatesPassed: true,
      ownershipMatch: true,
      worktreeClean: true,
      branchPushed: true,
      controlFileHashMatch: true,
      hasAcSection: false,
      hasBlankAc: false,
      hasUncheckedAc: false,
      taskId,
      currentStatus: task.status,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "MISSING_ACCEPTANCE_CRITERIA", nextCommands: [mapNextAction(result.nextAction)] }), json);
      return;
    }
    throw new MissingAcceptanceCriteriaError(taskId);
  }

  // Blank acceptance criteria check
  if (hasBlankAcceptanceCriteria(task.body)) {
    const result = doneStateMachine({
      validTransition: true,
      gatesPassed: true,
      ownershipMatch: true,
      worktreeClean: true,
      branchPushed: true,
      controlFileHashMatch: true,
      hasAcSection: true,
      hasBlankAc: true,
      hasUncheckedAc: false,
      taskId,
      currentStatus: task.status,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "BLANK_ACCEPTANCE_CRITERIA", nextCommands: [mapNextAction(result.nextAction)] }), json);
      return;
    }
    throw new BlankAcceptanceCriteriaError(taskId);
  }

  // Unchecked acceptance criteria check
  if (hasUncheckedAcceptanceCriteria(task.body)) {
    const result = doneStateMachine({
      validTransition: true,
      gatesPassed: true,
      ownershipMatch: true,
      worktreeClean: true,
      branchPushed: true,
      controlFileHashMatch: true,
      hasAcSection: true,
      hasBlankAc: false,
      hasUncheckedAc: true,
      taskId,
      currentStatus: task.status,
    });
    getDefaultGuidanceAdapter().pushGuidance(result);
    if (json) {
      writeResult(failedResult({ command: "done", error: result.guidance, code: result.errorCode ?? "UNCHECKED_ACCEPTANCE_CRITERIA", nextCommands: [mapNextAction(result.nextAction)] }), json);
      return;
    }
    throw new UncheckedAcceptanceCriteriaError(taskId);
  }

  // --- Completion policy check (PR-backed verification for code-bearing tasks) ---
  const config = loadConfig(repoRoot);
  const githubConfig = config.github;
  let verifier: GitHubPullRequestVerifier | undefined;
  if (githubConfig?.enabled && githubConfig.owner && githubConfig.repo) {
    verifier = new GitHubPullRequestVerifier(process.env.GITHUB_TOKEN);
  }

  const eligibility = await checkCompletionEligibility(
    task,
    {
      github: githubConfig,
      integrationBranch: config.project?.defaultBranch ?? "main",
    },
    verifier,
  );

  if (!eligibility.eligible) {
    // Build detailed failure message
    const details = eligibility.preconditions
      .filter((p) => !p.passed)
      .map((p) => `  [${p.code}] ${p.message}`)
      .join("\n");

    const message = [
      `Task ${taskId} cannot enter Done:`,
      details,
      eligibility.suggestedStatus
        ? `\nSuggested next status: ${eligibility.suggestedStatus}`
        : "",
    ].filter(Boolean).join("\n");

    if (!json) {
      logError(message);
    }

    const result = doneStateMachine({
      validTransition: true,
      gatesPassed: true,
      ownershipMatch: true,
      worktreeClean: true,
      branchPushed: true,
      controlFileHashMatch: true,
      hasAcSection: true,
      hasBlankAc: false,
      hasUncheckedAc: false,
      taskId,
      currentStatus: task.status,
    });

    getDefaultGuidanceAdapter().pushGuidance(result);

    if (json) {
      writeResult(failedResult({ command: "done", error: message, code: "COMPLETION_POLICY_BLOCKED", nextCommands: [mapNextAction(result.nextAction)] }), json);
      return;
    }

    throw new Error(message);
  }

  // Log successful completion policy in non-JSON mode
  if (!json && eligibility.preconditions.length > 0) {
    logSuccess("Completion policy: all preconditions satisfied");
  }

  updateTaskStatus(task.filePath, STATUS.DONE);

  // Clear the lock
  clearTaskLock(task.filePath);

  const today = new Date().toISOString().split("T")[0];
  const notes: string[] = [
    "Task marked Done",
  ].filter(Boolean);

  // Auto-remove doctor lock if completing a recovery task
  if (isDoctorLocked(repoRoot).locked) {
    removeDoctorLock(repoRoot);
    if (!json) logInfo("Doctor lock removed — recovery task completed.");
  }

  // Build success result through state machine
  const successResult = doneStateMachine({
    validTransition: true,
    gatesPassed: true,
    ownershipMatch: true,
    worktreeClean: true,
    branchPushed: true,
    controlFileHashMatch: true,
    hasAcSection: true,
    hasBlankAc: false,
    hasUncheckedAc: false,
    taskId,
    currentStatus: task.status,
  });
  getDefaultGuidanceAdapter().pushGuidance(successResult);

  if (json) {
    writeResult(buildSuccessResult({ command: "done", taskId: task.id, guidance: successResult.guidance, nextCommands: [mapNextAction(successResult.nextAction)] }), json);
    return;
  }

  logSuccess(successResult.guidance);
  writeResult(buildSuccessResult({ command: "done", taskId: task.id, guidance: successResult.guidance, nextCommands: [mapNextAction(successResult.nextAction)] }), json);
  logDivider();
  logInfo("Next actions:");
  logSub("  taskforge next              — Find the next available task");
  logSub(`  taskforge done ${taskId} --cleanup  — Remove worktree and branch`);
  logSub(`  taskforge done ${taskId} --delete-branch — Delete branch only`);

  appendTaskTranscript(repoRoot, taskId, createTaskEvent(taskId, "task.command.completed", {
    summary: `Task ${taskId} marked as Done`,
    metadata: { notes },
  }));

  // Remove session state file (task is done, no recovery needed)
  if (task.worktree) {
    removeSessionState(task.worktree);
  }

  // Mark agent as idle in registry
  if (task.assignee) {
    markAgentIdle(task.assignee, repoRoot);
  }

  // --- Cleanup: remove worktree ---
  if (cleanup) {
    await performCleanup(repoRoot, task, deleteBranch, today, notes);
  }

  appendAgentNote(task.filePath, today, "System", notes);

  // Push state changes through transaction
  await withTaskStateTransaction(
    { command: `done ${taskId}` },
    (tx) => { tx.clearClaim(taskId); },
  );
}

async function performCleanup(
  repoRoot: string,
  task: ParsedTask,
  deleteBranch: boolean,
  today: string,
  notes: string[],
): Promise<void> {
  const hadWorktreeField = !!(task.worktree || task.branch);

  // 1. Remove worktree
  if (task.worktree) {
    try {
      const removed = await removeWorktree(repoRoot, task.id);
      if (removed) {
        logSub(`Worktree removed: ${task.worktree}`);
        notes.push(`Worktree removed: ${task.worktree}`);
      } else {
        logInfo(`Worktree not found (already cleaned up): ${task.worktree}`);
        notes.push(`Worktree not found (already cleaned up): ${task.worktree}`);
      }
    } catch (err) {
      const msg = `Failed to remove worktree: ${err instanceof Error ? err.message : String(err)}`;
      logWarn(msg);
      notes.push(msg);
    }
  } else if (hadWorktreeField) {
    logInfo("No worktree path recorded in task — skipping worktree removal.");
  }

  // 2. Delete branch
  if (deleteBranch && task.branch) {
    try {
      const deleted = await removeBranch(repoRoot, task.branch);
      if (deleted) {
        logSub(`Branch deleted: ${task.branch}`);
        notes.push(`Branch deleted: ${task.branch}`);
      } else {
        logInfo(`Branch not found (already deleted): ${task.branch}`);
        notes.push(`Branch not found (already deleted): ${task.branch}`);
      }
    } catch (err) {
      const msg = `Failed to delete branch: ${err instanceof Error ? err.message : String(err)}`;
      logWarn(msg);
      notes.push(msg);
    }
  } else if (deleteBranch && !task.branch) {
    logInfo("No branch recorded in task — skipping branch deletion.");
  }

  // 3. Clear worktree/branch from frontmatter
  if (hadWorktreeField) {
    const current = parseTaskFile(task.filePath);
    if (current) {
      current.worktree = undefined;
      current.branch = undefined;
      writeTaskFile(current);
      logSub("Worktree and branch fields cleared from task frontmatter.");
      notes.push("Worktree and branch fields cleared from task frontmatter.");
    }
  }
}