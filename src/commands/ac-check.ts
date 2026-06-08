import { loadAllTasks, loadTaskById, hasAcceptanceCriteriaSection, hasBlankAcceptanceCriteria, hasUncheckedAcceptanceCriteria } from "../core/task-store.js";
import { getRepoRoot } from "../util/paths.js";
import { logInfo, logHeader, logError, logDivider } from "../util/logging.js";
import { printJson, jsonOk } from "../util/json-result.js";
import { successResult, failedResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";

export interface AcCheckOptions {
  json?: boolean;
}

interface AcIssue {
  taskId: string;
  type: "missing" | "blank" | "unchecked" | "duplicate";
  message: string;
}

export function cmdAcCheck(taskId?: string, options: AcCheckOptions = {}): void {
  const startTime = Date.now();
  const repoRoot = getRepoRoot();
  const issues: AcIssue[] = [];
  let scannedCount = 0;

  if (taskId) {
    const task = loadTaskById(taskId, repoRoot);
    if (!task) {
      const result = failedResult({
        command: "ac-check",
        error: `Task ${taskId} not found`,
        code: "TASK_NOT_FOUND",
        nextCommands: getValidNextCommands("ac-check", "success"),
        duration: Date.now() - startTime,
      });
      if (options.json) {
        process.stdout.write(renderResultJson(result) + "\n");
      } else {
        throw new Error(`Task ${taskId} not found`);
      }
      return;
    }
    checkTaskAc(task, issues);
    scannedCount = 1;
  } else {
    const tasks = loadAllTasks(repoRoot);
    scannedCount = tasks.length;
    for (const task of tasks) {
      checkTaskAc(task, issues);
    }
  }

  if (options.json) {
    printJson(jsonOk({
      issues,
      total: issues.length,
      scanned: scannedCount,
    }));
    return;
  }

  if (issues.length === 0) {
    const result = successResult({
      command: "ac-check",
      guidance: "All acceptance criteria look good.",
      nextCommands: getValidNextCommands("ac-check", "success"),
      duration: Date.now() - startTime,
    });
    process.stdout.write(renderResultMarkdown(result) + "\n");
    return;
  }

  logHeader(`# Acceptance Criteria Issues (${issues.length})`);
  logDivider();

  for (const issue of issues) {
    const icon = issue.type === "missing" ? "✗" : issue.type === "blank" ? "◌" : issue.type === "unchecked" ? "☐" : "⚠";
    logError(`${icon} ${issue.taskId}: ${issue.message}`);
  }

  logDivider();
  logInfo(`Scanned ${scannedCount} task(s), found ${issues.length} issue(s).`);

  const result = successResult({
    command: "ac-check",
    guidance: `Found ${issues.length} AC issue(s) across ${scannedCount} task(s).`,
    nextCommands: getValidNextCommands("ac-check", "success"),
    duration: Date.now() - startTime,
  });
  process.stdout.write(renderResultMarkdown(result) + "\n");
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
