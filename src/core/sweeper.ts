import { loadAllTasks, updateTaskStatus, clearTaskLock, appendAgentNote } from "./task-store.js";
import { jitteredPush } from "./git.js";
import { STATUS } from "../util/status-constants.js";
import { getRepoRoot } from "../util/paths.js";
import { logInfo, logSuccess, logSub, logWarn } from "../util/logging.js";

const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface SweepOptions {
  now?: Date;
  staleThresholdMs?: number;
  skipAssignee?: string;
  commit?: boolean;
}

export interface SweptTask {
  id: string;
  previousAssignee: string;
  claimedAt: string | Date;
  ageMs: number;
  filePath: string;
}

export interface SweepResult {
  scanned: number;
  stale: SweptTask[];
  changed: number;
  pushed: boolean;
}

function parseClaimedAt(value: string | Date): Date | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  const str = value as string;

  const match = str.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, year, month, day, hour, min, sec] = match.map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour, min, sec));
  }

  const iso = Date.parse(str);
  if (!isNaN(iso)) return new Date(iso);

  return null;
}

/**
 * Core sweeper logic: scan for stale In Progress tasks and recover them.
 * Returns a SweepResult describing what was done.
 *
 * Callers:
 *  - cmdSweep() in commands/sweep.ts (CLI wrapper)
 *  - cmdNext() in commands/next.ts (run before task selection)
 *  - cmdStart() in commands/start.ts (run before task claiming)
 */
export async function sweepStaleTasks(
  repoRoot?: string,
  options?: SweepOptions,
): Promise<SweepResult> {
  const root = repoRoot ?? getRepoRoot();
  const now = options?.now ?? new Date();
  const threshold = options?.staleThresholdMs ?? STALE_THRESHOLD_MS;
  const skipAssignee = options?.skipAssignee;
  const shouldCommit = options?.commit ?? true;

  const tasks = loadAllTasks(root);

  const staleTasks = tasks.filter((t) => {
    if (t.status !== STATUS.IN_PROGRESS) return false;
    if (!t.assignee || !t.claimed_at) return false;
    if (skipAssignee && t.assignee === skipAssignee) return false;

    const claimedTime = parseClaimedAt(t.claimed_at);
    if (!claimedTime) return false;

    const age = now.getTime() - claimedTime.getTime();
    return age > threshold;
  });

  const swept: SweptTask[] = [];

  for (const task of staleTasks) {
    const claimedTime = parseClaimedAt(task.claimed_at!)!;
    const ageMs = now.getTime() - claimedTime.getTime();

    swept.push({
      id: task.id,
      previousAssignee: task.assignee!,
      claimedAt: task.claimed_at!,
      ageMs,
      filePath: task.filePath,
    });

    // Reset to Ready
    updateTaskStatus(task.filePath, STATUS.READY);
    // Clear the claim
    clearTaskLock(task.filePath);

    const today = now.toISOString().split("T")[0];
    const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1);
    appendAgentNote(task.filePath, today, "System", [
      `Task swept by Sweeper Protocol — claim by "${task.assignee}" was ${ageHours}h old (threshold: 4h)`,
    ]);
  }

  let pushed = true;
  if (swept.length > 0 && shouldCommit) {
    pushed = await jitteredPush(root, `chore: sweep ${swept.length} stale task(s)`);
  }

  return {
    scanned: tasks.length,
    stale: swept,
    changed: swept.length,
    pushed,
  };
}

/**
 * CLI-friendly helper: run sweeper and print human-readable output.
 * Returns the SweepResult for programmatic use.
 */
export async function runSweeperAndPrint(
  repoRoot?: string,
  options?: SweepOptions,
): Promise<SweepResult> {
  const result = await sweepStaleTasks(repoRoot, options);

  if (result.changed === 0) {
    logInfo("Sweeper: No stale tasks found.");
    return result;
  }

  logInfo(`Sweeper: Found ${result.changed} stale task(s) with claims older than 4 hours.`);

  for (const swept of result.stale) {
    const ageHours = (swept.ageMs / (60 * 60 * 1000)).toFixed(1);
    logSub(`Resetting ${swept.id} (claimed by "${swept.previousAssignee}" ${ageHours}h ago)`);
    logSuccess(`  ${swept.id}: ${STATUS.IN_PROGRESS} → ${STATUS.READY} (claim cleared)`);
  }

  if (!result.pushed) {
    logWarn("Sweeper: failed to push state changes after retries. State changes are committed locally.");
  } else {
    logSuccess(`Sweeper: Recovered ${result.changed} stale task(s).`);
  }

  return result;
}
