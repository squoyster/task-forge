import fs from "node:fs";
import { execa } from "execa";
import { loadTaskById, loadAllTasks } from "../core/task-store.js";
import { getRepoRoot, getWorktreePath } from "../util/paths.js";
import { logHeader, logInfo, logSub, logDivider } from "../util/logging.js";
import { TaskNotFoundError } from "../core/errors.js";
import { STATUS } from "../util/status-constants.js";
import type { ParsedTask } from "../core/task-store.js";

export interface InspectResult {
  taskId: string;
  worktreeExists: boolean;
  branchExists: boolean;
  dirty: boolean;
  aheadOfMain: number;
  behindMain: number;
  lastCommit: string | null;
  claimStale: boolean;
  claimAgeHours: number | null;
}

export interface InspectOptions {
  all?: boolean;
  json?: boolean;
}

export async function cmdInspect(
  taskId: string,
  options: InspectOptions = {},
): Promise<InspectResult | null> {
  const { json = false } = options;
  const repoRoot = getRepoRoot();

  if (options.all) {
    const tasks = loadAllTasks(repoRoot)
      .filter((t) => t.status === STATUS.IN_PROGRESS);

    if (tasks.length === 0) {
      if (json) {
        console.log(JSON.stringify({ ok: true, tasks: [] }, null, 2));
        return null;
      }
      logInfo("No In Progress tasks to inspect.");
      return null;
    }

    const results: InspectResult[] = [];
    for (const task of tasks) {
      results.push(await inspectTask(task, repoRoot));
    }

    if (json) {
      console.log(JSON.stringify({ ok: true, tasks: results }, null, 2));
      return null;
    }

    logHeader("# Worktree Inspection");
    logDivider();
    for (const r of results) {
      printInspectResult(r);
    }
    return null;
  }

  const task = loadTaskById(taskId);
  if (!task) {
    throw new TaskNotFoundError(taskId);
  }

  const result = await inspectTask(task, repoRoot);

  if (json) {
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    return result;
  }

  logHeader("# Worktree Inspection");
  logDivider();
  printInspectResult(result);

  return result;
}

async function inspectTask(
  task: ParsedTask,
  repoRoot: string,
): Promise<InspectResult> {
  const expectedWorktreePath = getWorktreePath(repoRoot, task.id);
  const worktreeExists = fs.existsSync(expectedWorktreePath);

  let branchExists = false;
  let dirty = false;
  let aheadOfMain = 0;
  let behindMain = 0;
  let lastCommit: string | null = null;

  if (worktreeExists) {
    try {
      const branchList = await execa("git", ["branch", "--list"], {
        cwd: expectedWorktreePath,
      });
      if (task.branch) {
        branchExists = branchList.stdout.includes(task.branch);
      }

      const statusResult = await execa("git", ["status", "--porcelain"], {
        cwd: expectedWorktreePath,
      });
      dirty = statusResult.stdout.trim().length > 0;

      try {
        const aheadResult = await execa(
          "git", ["rev-list", "--count", `HEAD..origin/main`],
          { cwd: expectedWorktreePath },
        );
        aheadOfMain = parseInt(aheadResult.stdout.trim(), 10) || 0;
      } catch {
        aheadOfMain = 0;
      }

      try {
        const behindResult = await execa(
          "git", ["rev-list", "--count", `origin/main..HEAD`],
          { cwd: expectedWorktreePath },
        );
        behindMain = parseInt(behindResult.stdout.trim(), 10) || 0;
      } catch {
        behindMain = 0;
      }

      try {
        const commitResult = await execa(
          "git", ["rev-parse", "HEAD"],
          { cwd: expectedWorktreePath },
        );
        lastCommit = commitResult.stdout.trim().substring(0, 10);
      } catch {
        lastCommit = null;
      }
    } catch {
      // Git commands may fail if directory is not a git worktree
    }
  }

  const now = Date.now();
  let claimStale = false;
  let claimAgeHours: number | null = null;

  if (task.claimed_at) {
    const claimedStr = typeof task.claimed_at === "string"
      ? task.claimed_at
      : task.claimed_at.toISOString();
    const normalized = claimedStr.replace(" ", "T") + (claimedStr.includes("Z") ? "" : "Z");
    const claimedTime = new Date(normalized).getTime();
    const ageMs = now - claimedTime;
    claimAgeHours = ageMs / (1000 * 60 * 60);
    claimStale = claimAgeHours > 4;
  }

  return {
    taskId: task.id,
    worktreeExists,
    branchExists,
    dirty,
    aheadOfMain,
    behindMain,
    lastCommit,
    claimStale,
    claimAgeHours: claimAgeHours !== null ? Math.round(claimAgeHours * 10) / 10 : null,
  };
}

function printInspectResult(r: InspectResult): void {
  logInfo(`Task: ${r.taskId}`);
  logSub(`  Worktree: ${r.worktreeExists ? "exists" : "missing"}`);
  logSub(`  Branch:   ${r.branchExists ? "exists" : "missing"}`);
  logSub(`  Dirty:    ${r.dirty ? "yes" : "no"}`);
  logSub(`  Ahead:    ${r.aheadOfMain} | Behind: ${r.behindMain}`);
  logSub(`  Commit:   ${r.lastCommit ?? "n/a"}`);
  logSub(`  Lease:    ${r.claimStale ? "STALE" : "fresh"} (${r.claimAgeHours ?? "n/a"}h)`);
  logDivider();
}
