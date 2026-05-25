import { loadAllTasks, loadTaskById, hasAcceptanceCriteriaSection, hasBlankAcceptanceCriteria, hasUncheckedAcceptanceCriteria } from "../core/task-store.js";
import { getRepoRoot } from "../util/paths.js";
import { logInfo, logHeader, logSuccess, logError, logDivider } from "../util/logging.js";
import { printJson, jsonOk, jsonError } from "../util/json-result.js";

export interface AcCheckOptions {
  json?: boolean;
}

interface AcIssue {
  taskId: string;
  type: "missing" | "blank" | "unchecked" | "duplicate";
  message: string;
}

export function cmdAcCheck(taskId?: string, options: AcCheckOptions = {}): void {
  const repoRoot = getRepoRoot();
  const issues: AcIssue[] = [];

  if (taskId) {
    const task = loadTaskById(taskId, repoRoot);
    if (!task) {
      if (options.json) {
        printJson(jsonError(`Task ${taskId} not found`, "TASK_NOT_FOUND"));
        return;
      }
      throw new Error(`Task ${taskId} not found`);
    }
    checkTaskAc(task, issues);
  } else {
    const tasks = loadAllTasks(repoRoot);
    for (const task of tasks) {
      checkTaskAc(task, issues);
    }
  }

  if (options.json) {
    printJson(jsonOk({
      issues,
      total: issues.length,
      scanned: taskId ? 1 : loadAllTasks(repoRoot).length,
    }));
    return;
  }

  if (issues.length === 0) {
    logSuccess("All acceptance criteria look good.");
    return;
  }

  logHeader(`# Acceptance Criteria Issues (${issues.length})`);
  logDivider();

  for (const issue of issues) {
    const icon = issue.type === "missing" ? "✗" : issue.type === "blank" ? "◌" : issue.type === "unchecked" ? "☐" : "⚠";
    logError(`${icon} ${issue.taskId}: ${issue.message}`);
  }

  logDivider();
  logInfo(`Scanned ${taskId ? 1 : loadAllTasks(repoRoot).length} task(s), found ${issues.length} issue(s).`);
}

function checkTaskAc(task: { id: string; body: string }, issues: AcIssue[]): void {
  if (!hasAcceptanceCriteriaSection(task.body)) {
    issues.push({ taskId: task.id, type: "missing", message: "Missing Acceptance Criteria section" });
    return;
  }

  if (hasDuplicateAcSections(task.body)) {
    issues.push({ taskId: task.id, type: "duplicate", message: "Duplicate Acceptance Criteria sections" });
  }

  if (hasBlankAcceptanceCriteria(task.body)) {
    issues.push({ taskId: task.id, type: "blank", message: "Has blank acceptance criteria items" });
  }

  if (hasUncheckedAcceptanceCriteria(task.body)) {
    issues.push({ taskId: task.id, type: "unchecked", message: "Has unchecked acceptance criteria items" });
  }
}

function hasDuplicateAcSections(body: string): boolean {
  const matches = body.match(/## Acceptance Criteria/gi);
  return matches !== null && matches.length > 1;
}
