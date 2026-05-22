import { execa } from "execa";
import { loadTaskById, updateTaskStatus, appendAgentNote } from "../core/task-store.js";
import { validateTransition } from "../core/status-transition.js";
import { commitAndPushTaskState } from "../core/git.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { STATUS } from "../util/status-constants.js";
import { logHeader, logSuccess, logSub, logDivider } from "../util/logging.js";
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
    const transitionError = validateTransition(task.status, STATUS.REVIEW);
    if (transitionError) {
      if (options?.json) {
        printJson(jsonError(transitionError, "INVALID_TRANSITION"));
        return;
      }
      throw new InvalidStatusTransitionError(task.status, STATUS.REVIEW, [STATUS.IN_PROGRESS]);
    }

    updateTaskStatus(task.filePath, STATUS.REVIEW);

    const today = new Date().toISOString().split("T")[0];
    appendAgentNote(task.filePath, today, "System", [
      `Report generated — task moved to Review`,
      `Changed files: ${changedFiles.length > 0 ? changedFiles.join(", ") : "none"}`,
      `Commits: ${commits.length > 0 ? commits.join(", ") : "none"}`,
    ]);

    await commitAndPushTaskState(repoRoot, `chore: report ${taskId} → Review`);
  }

  if (options?.json) {
    printJson(jsonOk({
      ...report,
    } as never));
    return;
  }

  logHeader(`# Report: ${taskId}`);
  logDivider();
  logSub(`Status: ${options?.complete ? "Review" : task.status}`);
  logSub(`Changed files: ${changedFiles.length > 0 ? changedFiles.join(", ") : "none"}`);
  logSub(`Commits: ${commits.length > 0 ? commits.join(", ") : "none"}`);
  logDivider();
  if (options?.complete) {
    logSuccess(`Task ${taskId} moved to Review.`);
  }
}
