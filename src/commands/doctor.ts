import { loadAllTasks } from "../core/task-store.js";
import { listWorktrees } from "../core/git.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { loadConfig } from "../core/config.js";
import { logHeader, logSuccess, logWarn, logInfo, logSub, logDivider } from "../util/logging.js";
import { STATUS } from "../util/status-constants.js";
import fs from "node:fs";

export async function cmdDoctor(options?: { json?: boolean; fix?: boolean }): Promise<void> {
  const repoRoot = getRepoRoot();
  const tasks = loadAllTasks(repoRoot);
  const worktrees = await listWorktrees(repoRoot);

  const issues: string[] = [];
  const ok: string[] = [];

  // Check task-state exists
  const taskStateDir = `${repoRoot}/../task-state`;
  if (!fs.existsSync(taskStateDir)) {
    issues.push("Task-state worktree missing — run 'taskforge init'");
  } else {
    ok.push("Task-state worktree exists");
  }

  // Check config
  try {
    loadConfig(repoRoot);
    ok.push("Config is valid JSON");
  } catch {
    issues.push("Config.json is invalid or missing");
  }

  // Orphan worktrees
  for (const wt of worktrees) {
    const wtName = wt.path.split("/").pop()!;
    if (wtName === "task-state") continue;
    const hasTask = tasks.some((t) => t.id === wtName);
    if (!hasTask) issues.push(`Orphan worktree: ${wt.branch} at ${wt.path}`);
  }
  if (worktrees.every((wt) => tasks.some((t) => t.id === wt.path.split("/").pop()) || wt.path.includes("task-state"))) {
    ok.push("No orphan worktrees");
  }

  // Stale locks
  for (const t of tasks) {
    if (t.status === STATUS.IN_PROGRESS) {
      const wtPath = getWorktreePath(repoRoot, t.id);
      if (!fs.existsSync(wtPath)) {
        issues.push(`Stale lock: ${t.id} is In Progress but worktree missing`);
      }
    }
  }
  const staleCount = tasks.filter((t) => t.status === STATUS.IN_PROGRESS && !fs.existsSync(getWorktreePath(repoRoot, t.id))).length;
  if (staleCount === 0) ok.push("No stale locks");

  // Duplicate IDs
  const ids = tasks.map((t) => t.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) issues.push(`Duplicate task IDs: ${dupes.join(", ")}`);
  else ok.push("No duplicate task IDs");

  // Sweeper recommendations
  const now = Date.now();
  const staleThreshold = 4 * 60 * 60 * 1000;
  const sweepable = tasks.filter((t) => {
    if (t.status !== STATUS.IN_PROGRESS || !t.claimed_at) return false;
    const claimed = new Date(t.claimed_at).getTime();
    return now - claimed > staleThreshold;
  });
  if (sweepable.length > 0) issues.push(`${sweepable.length} task(s) would be swept on next run`);

  if (options?.json) {
    console.log(JSON.stringify({
      ok: issues.length === 0,
      issues,
      checks: ok,
      counts: { total: tasks.length, inProgress: tasks.filter((t) => t.status === STATUS.IN_PROGRESS).length, ready: tasks.filter((t) => t.status === STATUS.READY).length, done: tasks.filter((t) => t.status === STATUS.DONE).length, worktrees: worktrees.length, stale: staleCount, sweepable: sweepable.length },
    }, null, 2));
    return;
  }

  logHeader("# TaskForge Doctor");
  logDivider();
  for (const o of ok) logSuccess(`✓ ${o}`);
  for (const i of issues) logWarn(`✗ ${i}`);
  logDivider();
  logInfo(`Tasks: ${tasks.length} total | Stale locks: ${staleCount} | Sweepable: ${sweepable.length}`);
}
