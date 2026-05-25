import { loadAllTasks, hasAcceptanceCriteriaSection, hasBlankAcceptanceCriteria, hasUncheckedAcceptanceCriteria } from "../core/task-store.js";
import { listWorktrees } from "../core/git.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { loadConfig } from "../core/config.js";
import { logHeader, logSuccess, logWarn, logInfo, logDivider } from "../util/logging.js";
import { STATUS } from "../util/status-constants.js";
import { inspectTask } from "./inspect.js";
import { validateTaskState } from "../core/state-validator.js";
import { checkHooks } from "../core/hooks.js";
import { validateJsonlFiles } from "../core/audit.js";
import { getAgentFrameworkAdapter, type DoctorIssue, type DoctorRepair } from "../core/agent-framework-adapter.js";
import path from "node:path";
import fs from "node:fs";

export async function cmdDoctor(options?: { json?: boolean; fix?: boolean }): Promise<void> {
  const repoRoot = getRepoRoot();
  const config = loadConfig(repoRoot);
  const tasks = loadAllTasks(repoRoot);
  const worktrees = await listWorktrees(repoRoot);

  const issues: DoctorIssue[] = [];
  const ok: string[] = [];

  function add(severity: DoctorIssue["severity"], msg: string, taskId?: string, code = "GENERIC") {
    issues.push({ severity, code, message: msg, taskId });
  }

  // 1. Task-state exists
  const taskStateDir = `${repoRoot}/../task-state`;
  if (!fs.existsSync(taskStateDir)) {
    add("error", "Task-state worktree missing — run 'taskforge init'");
  } else {
    ok.push("Task-state worktree exists");
  }

  // 2. Config
  try {
    loadConfig(repoRoot);
    ok.push("Config is valid");
  } catch {
    add("error", "Config.json is invalid or missing");
  }

  // 3. State invariant validation
  const validation = validateTaskState(tasks);
  for (const e of validation.errors) add("error", `[${e.code}] ${e.message}`, e.taskId);
  for (const w of validation.warnings) add("warn", `[${w.code}] ${w.message}`, w.taskId);

  // 4. Orphan worktrees
  for (const wt of worktrees) {
    const wtName = wt.path.split("/").pop()!;
    if (wtName === "task-state") continue;
    if (!tasks.some((t) => t.id === wtName)) {
      add("warn", `Orphan worktree: ${wt.branch} at ${wt.path}`);
    }
  }

  // 5. Stale locks + deep inspection
  const inProgressTasks = tasks.filter((t) => t.status === STATUS.IN_PROGRESS);
  for (const t of inProgressTasks) {
    const wtPath = getWorktreePath(repoRoot, t.id);

    // Stale lock check
    if (!fs.existsSync(wtPath)) {
      add("warn", `Stale lock: worktree missing`, t.id);
    }

    // Deep inspect
    try {
      const insp = await inspectTask(t, repoRoot);
      if (insp.dirty) add("warn", `Dirty worktree — uncommitted changes`, t.id);
      if (insp.aheadOfMain > 0) add("warn", `${insp.aheadOfMain} commit(s) ahead of main — may need Review`, t.id);
      if (insp.claimStale) add("warn", `Claim is stale (${insp.claimAgeHours?.toFixed(1)}h) — sweeper will recover`, t.id);
    } catch {
      // inspect may fail if worktree doesn't exist
    }
  }

  // 6. Impossible state combinations
  for (const t of tasks) {
    if (t.status === STATUS.DONE && t.assignee) add("error", `Done but still claimed`, t.id);
    if (t.status === STATUS.READY && t.assignee) add("warn", `Ready but has assignee — sweep may have failed to clear lock`, t.id);
    if (t.status === STATUS.IN_PROGRESS && !t.assignee) add("warn", `In Progress but no assignee`, t.id);
    if (t.status === STATUS.BLOCKED && !t.blocked_reason) add("warn", `Blocked but no blocked_reason`, t.id);
    if (t.status === STATUS.REVIEW && t.assignee) add("warn", `Review but still claimed`, t.id);
  }

  // 7. Broken dependsOn references
  const allIds = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    if (t.dependsOn) {
      for (const dep of t.dependsOn) {
        if (!allIds.has(dep)) add("error", `dependsOn references non-existent task: ${dep}`, t.id);
        const depTask = tasks.find((d) => d.id === dep);
        if (depTask && depTask.status !== STATUS.DONE) add("info", `dependsOn ${dep} is not Done (status: ${depTask.status})`, t.id);
      }
    }
  }

  // 8. Sweeper preview
  const now = Date.now();
  const staleThreshold = 4 * 60 * 60 * 1000;
  let sweepable = 0;
  for (const t of tasks) {
    if (t.status !== STATUS.IN_PROGRESS || !t.claimed_at) continue;
    const claimed = new Date(t.claimed_at).getTime();
    if (now - claimed > staleThreshold) {
      sweepable++;
      try {
        const insp = await inspectTask(t, repoRoot);
        if (insp.dirty) add("info", `Sweepable but dirty — would be skipped by sweeper`, t.id);
        else if (insp.aheadOfMain > 0) add("info", `Sweepable with ${insp.aheadOfMain} ahead — would move to Review`, t.id);
        else add("info", `Sweepable — would reset to Ready`, t.id);
      } catch {
        add("info", `Sweepable — would reset to Ready`, t.id);
      }
    }
  }

  // 9. Agent framework diagnostics
  const adapter = getAgentFrameworkAdapter(config.agentFramework?.id);
  const adapterIssues = adapter.doctor(repoRoot);
  for (const issue of adapterIssues) {
    if (issue.severity === "info") {
      ok.push(issue.message);
    } else {
      issues.push(issue);
    }
  }

  // 9b. Agent framework fix (if --fix)
  const repairs: DoctorRepair[] = [];
  if (options?.fix) {
    const adapterRepairs = adapter.fix(repoRoot);
    repairs.push(...adapterRepairs);
    for (const repair of adapterRepairs) {
      ok.push(`Repaired: ${repair.message}`);
    }
  }

  // 10. Audit JSONL validation
  const jsonlIssues = validateJsonlFiles(repoRoot);
  for (const issue of jsonlIssues) {
    const relativePath = path.relative(repoRoot, issue.filePath);
    const reason = issue.reason === "parse_error" ? "invalid JSON" : "schema validation failed";
    add("warn", `Corrupted JSONL line in ${relativePath}:${issue.line} (${reason})`, undefined, "JSONL_CORRUPT");
  }

  // 10. Git hooks check
  const hooksResult = checkHooks(repoRoot);
  if (hooksResult.ok) {
    ok.push("Git hooks installed and executable");
  } else {
    for (const issue of hooksResult.issues) {
      add("warn", issue);
    }
  }

  // 11. Done tasks with invalid acceptance criteria
  const doneTasks = tasks.filter((t) => t.status === STATUS.DONE);
  for (const t of doneTasks) {
    if (!hasAcceptanceCriteriaSection(t.body)) {
      add("warn", "Done task missing acceptance criteria section", t.id, "AC_MISSING");
    } else if (hasBlankAcceptanceCriteria(t.body)) {
      add("warn", "Done task has blank acceptance criteria", t.id, "AC_BLANK");
    } else if (hasUncheckedAcceptanceCriteria(t.body)) {
      add("warn", "Done task has unchecked acceptance criteria", t.id, "AC_UNCHECKED");
    }
  }

  // Output
  if (options?.json) {
    console.log(JSON.stringify({
      ok: issues.filter((i) => i.severity === "error").length === 0,
      issues: issues.map((i) => ({ severity: i.severity, code: i.code, taskId: i.taskId, message: i.message })),
      repairs: repairs.map((r) => ({ code: r.code, message: r.message })),
      checks: ok,
      counts: {
        total: tasks.length,
        inProgress: inProgressTasks.length,
        ready: tasks.filter((t) => t.status === STATUS.READY).length,
        done: tasks.filter((t) => t.status === STATUS.DONE).length,
        worktrees: worktrees.length,
        sweepable,
        errors: issues.filter((i) => i.severity === "error").length,
        warnings: issues.filter((i) => i.severity === "warn").length,
        repairs: repairs.length,
      },
    }, null, 2));
    return;
  }

  logHeader("# TaskForge Doctor");
  logDivider();
  for (const o of ok) logSuccess(`✓ ${o}`);
  for (const i of issues) {
    const prefix = i.severity === "error" ? "✗" : i.severity === "warn" ? "⚠" : "ℹ";
    const taskLabel = i.taskId ? ` [${i.taskId}]` : "";
    const logFn = i.severity === "error" ? logWarn : i.severity === "warn" ? logWarn : logInfo;
    logFn(`${prefix}${taskLabel} ${i.message}`);
  }
  if (repairs.length > 0) {
    logDivider();
    logHeader("## Repairs");
    for (const r of repairs) {
      logSuccess(`✓ ${r.message}`);
    }
  }
  logDivider();
  const errCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warn").length;
  logInfo(`Tasks: ${tasks.length} total | Errors: ${errCount} | Warnings: ${warnCount} | Sweepable: ${sweepable} | Repairs: ${repairs.length}`);
}
