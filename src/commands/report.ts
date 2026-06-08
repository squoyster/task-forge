import { execa } from "execa";
import { loadTaskById, updateTaskStatus, appendAgentNote, hasAcceptanceCriteriaSection, hasBlankAcceptanceCriteria, hasUncheckedAcceptanceCriteria } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { commitAndPushTaskState } from "../core/git.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { STATUS } from "../util/status-constants.js";
import { logHeader, logSuccess, logSub, logDivider, logInfo, logWarn } from "../util/logging.js";
import { TaskNotFoundError, InvalidStatusTransitionError } from "../core/errors.js";
import { printJson, jsonOk, jsonError } from "../util/json-result.js";

export interface ReportOptions {
  complete?: boolean;
  json?: boolean;
}

interface GateResults {
  typecheck: string;
  lint: string;
  build: string;
  test: string;
}

interface ReportData {
  taskId: string;
  status: string;
  changedFiles: string[];
  commits: string[];
  gates: GateResults;
  risks: string[];
  humanReviewNeeded: boolean;
}

export async function cmdReport(taskId: string, options?: ReportOptions): Promise<void> {
  const repoRoot = getRepoRoot();
  const task = loadTaskById(taskId);

  if (!task) {
    if (options?.json) {
      printJson(jsonError(`Task ${taskId} not found`, "TASK_NOT_FOUND"));
      return;
    }
    throw new TaskNotFoundError(taskId);
  }

  const worktreePath = getWorktreePath(repoRoot, taskId);

  const changedFiles: string[] = [];
  const commits: string[] = [];
  let gates: GateResults = { typecheck: "unknown", lint: "unknown", build: "unknown", test: "unknown" };

  try {
    const diffResult = await execa("git", ["diff", "--name-only", `origin/main..HEAD`], { cwd: worktreePath });
    changedFiles.push(...diffResult.stdout.trim().split("\n").filter(Boolean));

    const logResult = await execa("git", ["log", "--oneline", `origin/main..HEAD`], { cwd: worktreePath });
    commits.push(...logResult.stdout.trim().split("\n").filter(Boolean));
  } catch {
    // Worktree may not exist or have no commits — that's fine
  }

  const report: ReportData = {
    taskId,
    status: task.status,
    changedFiles,
    commits,
    gates,
    risks: [],
    humanReviewNeeded: task.humanInterventionRequired ?? changedFiles.length > 0,
  };

  if (options?.complete) {
    const transitionError = validateTransition(task.status, STATUS.IMPLEMENTATION_COMPLETE);
    if (transitionError) {
      if (options?.json) {
        printJson(jsonError(transitionError, "INVALID_TRANSITION"));
        return;
      }
      throw new InvalidStatusTransitionError(task.status, STATUS.IMPLEMENTATION_COMPLETE, [STATUS.IN_PROGRESS]);
    }

    // Check AC state for reviewer awareness
    const hasAC = hasAcceptanceCriteriaSection(task.body);
    const hasBlankAC = hasAC && hasBlankAcceptanceCriteria(task.body);
    const hasUncheckedAC = hasAC && hasUncheckedAcceptanceCriteria(task.body);

    updateTaskStatus(task.filePath, STATUS.IMPLEMENTATION_COMPLETE);

    const today = new Date().toISOString().split("T")[0];
    appendAgentNote(task.filePath, today, "System", [
      `Report generated — task moved to Implementation Complete`,
      `Changed files: ${changedFiles.length > 0 ? changedFiles.join(", ") : "none"}`,
      `Commits: ${commits.length > 0 ? commits.join(", ") : "none"}`,
      `AC section: ${hasAC ? "present" : "missing"}`,
      hasBlankAC ? "AC has blank items" : "",
      hasUncheckedAC ? "AC has unchecked items" : "",
    ].filter(Boolean));

    await commitAndPushTaskState(repoRoot, `chore: report ${taskId} → Implementation Complete`);

    if (options?.json) {
      printJson(jsonOk({
        ...report,
        status: STATUS.IMPLEMENTATION_COMPLETE,
        acceptanceCriteria: {
          sectionPresent: hasAC,
          hasBlankItems: hasBlankAC,
          hasUncheckedItems: hasUncheckedAC,
        },
        reviewerInstructions: [
          "Verify all acceptance criteria are satisfied with evidence.",
          "Check that each AC checkbox is checked off with source file, identifier, and rationale.",
          "Run gates (typecheck, lint, build, test) and confirm all pass.",
          "Review code changes for correctness, security, and scope compliance.",
          "If any AC is not satisfied, move task back to In Progress with feedback.",
        ],
        nextActions: [
          { command: `taskforge done ${taskId}`, reason: "Mark task as Done after AC verification passes", safety: "safe", preferred: true },
          { command: `taskforge start ${taskId}`, reason: "Return to In Progress if AC verification fails", safety: "safe", preferred: false },
          { command: `taskforge block ${taskId} "AC verification failed: <details>" --category ambiguous_spec --blocked-by reviewer`, reason: "Block if AC are unclear or cannot be verified", safety: "safe", preferred: false },
        ],
      } as never));
      return;
    }

    logHeader(`# Report: ${taskId}`);
    logDivider();
    logSub(`Status: ${STATUS.IMPLEMENTATION_COMPLETE}`);
    logSub(`Changed files: ${changedFiles.length > 0 ? changedFiles.join(", ") : "none"}`);
    logSub(`Commits: ${commits.length > 0 ? commits.join(", ") : "none"}`);
    logDivider();
    logSuccess(`Task ${taskId} moved to Implementation Complete.`);
    logDivider();
    logInfo("Reviewer Instructions:");
    logSub("1. Read the task file and extract every acceptance criterion.");
    logSub("2. Verify each AC is satisfied with explicit evidence:");
    logSub("   - Source file (e.g., src/commands/validate-state.ts)");
    logSub("   - Identifier (function name, test name, or ~line number)");
    logSub("   - Rationale (one sentence on how the code satisfies the AC)");
    logSub("3. Run gates: npm run typecheck && npm run lint && npm run build && npm test -- --run");
    logSub("4. If all AC pass → taskforge done TASK-ID");
    logSub("5. If any AC fails → taskforge start TASK-ID (return to In Progress)");
    logSub("6. If AC are unclear → taskforge block TASK-ID \"reason\" --category ambiguous_spec");
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
    printJson(jsonOk({
      ...report,
      nextActions: options?.complete
        ? []
        : [
            { command: `taskforge report ${taskId} --complete`, reason: "Generate completion report and move to Implementation Complete", safety: "safe", preferred: true },
            { command: `taskforge gates`, reason: "Run gates before generating report", safety: "safe", preferred: false },
          ],
    } as never));
    return;
  }

  logHeader(`# Report: ${taskId}`);
  logDivider();
  logSub(`Status: ${options?.complete ? STATUS.IMPLEMENTATION_COMPLETE : task.status}`);
  logSub(`Changed files: ${changedFiles.length > 0 ? changedFiles.join(", ") : "none"}`);
  logSub(`Commits: ${commits.length > 0 ? commits.join(", ") : "none"}`);
  logDivider();
  if (!options?.complete) {
    logInfo("Next actions:");
    logSub(`  taskforge report ${taskId} --complete  — Generate completion report and move to Implementation Complete`);
    logSub(`  taskforge gates                       — Run gates before generating report`);
  }
}
