import { execa } from "execa";
import { loadTaskById, updateTaskStatus, appendAgentNote, hasAcceptanceCriteriaSection, hasBlankAcceptanceCriteria, hasUncheckedAcceptanceCriteria } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { commitAndPushTaskState } from "../core/git.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { STATUS } from "../util/status-constants.js";
import { logHeader, logSuccess, logSub, logDivider, logInfo, logWarn } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError } from "../core/errors.js";
import { writeResult } from "../util/write-command-result.js";
import { successResult, failedResult } from "../core/result-builder.js";

export interface ReportOptions {
  complete?: boolean;
  json?: boolean;
}

export async function cmdReport(taskId: string, options?: ReportOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (options?.json) {
      writeResult(failedResult({ command: "report", taskId, error: `Task ${taskId} not found`, code: "TASK_NOT_FOUND" }), options.json);
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  const worktreePath = getWorktreePath(repoRoot, taskId);

  const changedFiles: string[] = [];
  const commits: string[] = [];

  try {
    const diffResult = await execa("git", ["diff", "--name-only", `origin/main..HEAD`], { cwd: worktreePath });
    changedFiles.push(...diffResult.stdout.trim().split("\n").filter(Boolean));

    const logResult = await execa("git", ["log", "--oneline", `origin/main..HEAD`], { cwd: worktreePath });
    commits.push(...logResult.stdout.trim().split("\n").filter(Boolean));
  } catch {
    // Worktree may not exist or have no commits — that's fine
  }

  if (options?.complete) {
    // report --complete enters Review (TF-SIMP-02): implementation is done and
    // ready for review. Reviewers gate the path to Verify/Done.
    const transitionError = validateTransition(task.status, STATUS.REVIEW);
    if (transitionError) {
      if (options?.json) {
        writeResult(failedResult({ command: "report", taskId, error: transitionError, code: "INVALID_TRANSITION" }), options.json);
        return;
      }
      throw new InvalidStatusTransitionError(task.status, STATUS.REVIEW, [STATUS.IN_PROGRESS]);
    }

    // Check AC state for reviewer awareness
    const hasAC = hasAcceptanceCriteriaSection(task.body);
    const hasBlankAC = hasAC && hasBlankAcceptanceCriteria(task.body);
    const hasUncheckedAC = hasAC && hasUncheckedAcceptanceCriteria(task.body);

    updateTaskStatus(task.filePath, STATUS.REVIEW);

    const today = new Date().toISOString().split("T")[0];
    appendAgentNote(task.filePath, today, "System", [
      `Report generated — task moved to Review`,
      `Changed files: ${changedFiles.length > 0 ? changedFiles.join(", ") : "none"}`,
      `Commits: ${commits.length > 0 ? commits.join(", ") : "none"}`,
      `AC section: ${hasAC ? "present" : "missing"}`,
      hasBlankAC ? "AC has blank items" : "",
      hasUncheckedAC ? "AC has unchecked items" : "",
    ].filter(Boolean));

    await commitAndPushTaskState(repoRoot, `chore: report ${taskId} → Review`);

    if (options?.json) {
      writeResult(successResult({
        command: "report",
        taskId,
        guidance: `Task ${taskId} moved to Review. Verify AC before advancing to Verify/Done.`,
        nextCommands: [
          { command: `taskforge promote ${taskId} --to Verify`, purpose: "Advance to verification after review passes", when: "Advance to verification after review passes", allowedFor: "all", priority: 1 },
          { command: `taskforge promote ${taskId} --to "In Progress"`, purpose: "Return to In Progress if AC verification fails", when: "Return to In Progress if AC verification fails", allowedFor: "all", priority: 2 },
          { command: `taskforge block ${taskId} "AC verification failed: <details>" --category ambiguous_spec --blocked-by reviewer`, purpose: "Block if AC are unclear or cannot be verified", when: "Block if AC are unclear or cannot be verified", allowedFor: "all", priority: 3 },
        ],
      }), options.json);
      return;
    }

    logHeader(`# Report: ${taskId}`);
    logDivider();
    logSub(`Status: ${STATUS.REVIEW}`);
    logSub(`Changed files: ${changedFiles.length > 0 ? changedFiles.join(", ") : "none"}`);
    logSub(`Commits: ${commits.length > 0 ? commits.join(", ") : "none"}`);
    logDivider();
    logSuccess(`Task ${taskId} moved to Review.`);
    logDivider();
    logInfo("Reviewer Instructions:");
    logSub("1. Read the task file and extract every acceptance criterion.");
    logSub("2. Verify each AC is satisfied with explicit evidence:");
    logSub("   - Source file (e.g., src/commands/validate-state.ts)");
    logSub("   - Identifier (function name, test name, or ~line number)");
    logSub("   - Rationale (one sentence on how the code satisfies the AC)");
    logSub("3. Run gates: npm run typecheck && npm run lint && npm run build && npm test -- --run");
    logSub(`4. If all AC pass → taskforge promote ${taskId} --to Verify`);
    logSub(`5. If any AC fails → taskforge promote ${taskId} --to "In Progress"`);
    logSub(`6. If AC are unclear → taskforge block ${taskId} "reason" --category ambiguous_spec`);
    logDivider();
    if (!hasAC) {
      logWarn("Warning: No Acceptance Criteria section found in task file.");
    } else if (hasBlankAC) {
      logWarn("Warning: Some acceptance criteria have blank/placeholder text.");
    } else if (hasUncheckedAC) {
      logWarn("Warning: Some acceptance criteria are still unchecked.");
    }
    return;
  }

  if (options?.json) {
    writeResult(successResult({
      command: "report",
      taskId,
      guidance: `Report generated for ${taskId}.`,
      nextCommands: [
        { command: `taskforge report ${taskId} --complete`, purpose: "Generate completion report and move to Review", when: "Generate completion report and move to Review", allowedFor: "all", priority: 1 },
        { command: "taskforge gates", purpose: "Run gates before generating report", when: "Run gates before generating report", allowedFor: "all", priority: 2 },
      ],
    }), options.json);
    return;
  }

  logHeader(`# Report: ${taskId}`);
  logDivider();
  logSub(`Status: ${options?.complete ? STATUS.REVIEW : task.status}`);
  logSub(`Changed files: ${changedFiles.length > 0 ? changedFiles.join(", ") : "none"}`);
  logSub(`Commits: ${commits.length > 0 ? commits.join(", ") : "none"}`);
  logDivider();
  if (!options?.complete) {
    logInfo("Next actions:");
    logSub(`  taskforge report ${taskId} --complete  — Generate completion report and move to Review`);
    logSub(`  taskforge gates                       — Run gates before generating report`);
  }
}
