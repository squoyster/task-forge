import { loadAllTasks, updateTaskStatus, clearTaskLock, appendAgentNote } from "./task-store.js";
import { withTaskStateTransaction } from "./task-state-transaction.js";
import { STATUS } from "../util/status-constants.js";
import { getRepoRoot } from "../util/paths.js";
import { logInfo, logSuccess, logSub, logWarn } from "../util/logging.js";
import type { InspectResult } from "../commands/inspect.js";
import type { ParsedTask } from "./task-store.js";

const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface SweepOptions {
  now?: Date;
  staleThresholdMs?: number;
  skipAssignee?: string;
  commit?: boolean;
  dryRun?: boolean;
  force?: boolean;
  inspectTask?: (task: ParsedTask, repoRoot: string) => Promise<InspectResult>;
}

export interface SweptTask {
  id: string;
  previousAssignee: string;
  claimedAt: string | Date;
  ageMs: number;
  filePath: string;
  action: "reset" | "review" | "skipped";
  reason?: string;
}

export interface SweepResult {
  scanned: number;
  stale: SweptTask[];
  changed: number;
  pushed: boolean;
  dryRun?: boolean;
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

export async function sweepStaleTasks(
  repoRoot?: string,
  options?: SweepOptions,
): Promise<SweepResult> {
  const root = repoRoot ?? getRepoRoot();
  const now = options?.now ?? new Date();
  const threshold = options?.staleThresholdMs ?? STALE_THRESHOLD_MS;
  const skipAssignee = options?.skipAssignee;
  const shouldCommit = options?.commit ?? true;
  const dryRun = options?.dryRun ?? false;
  const force = options?.force ?? false;
  const inspectTaskFn = options?.inspectTask;

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
  let changedCount = 0;

  for (const task of staleTasks) {
    const claimedTime = parseClaimedAt(task.claimed_at!)!;
    const ageMs = now.getTime() - claimedTime.getTime();

    let action: "reset" | "review" | "skipped" = "reset";
    let reason: string | undefined;

    // Classify worktree state unless --force
    if (!force && inspectTaskFn) {
      try {
        const insp = await inspectTaskFn(task, root);
        if (insp.dirty) {
          action = "skipped";
          reason = "dirty worktree — uncommitted changes";
        } else if (insp.aheadOfMain > 0) {
          action = "review";
          reason = `worktree has ${insp.aheadOfMain} commit(s) ahead of main — moving to Review`;
        }
      } catch {
        // Inspect may fail if worktree doesn't exist — that's fine, default to reset
      }
    }

    const entry: SweptTask = {
      id: task.id,
      previousAssignee: task.assignee!,
      claimedAt: task.claimed_at!,
      ageMs,
      filePath: task.filePath,
      action,
      reason,
    };
    swept.push(entry);

    if (action === "skipped") continue;

    if (!dryRun) {
      if (action === "review") {
        updateTaskStatus(task.filePath, STATUS.REVIEW);
      } else {
        updateTaskStatus(task.filePath, STATUS.READY);
      }
      clearTaskLock(task.filePath);

      const today = now.toISOString().split("T")[0];
      const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1);
      const actionLabel = action === "review" ? "moved to Review" : "reset to Ready";
      appendAgentNote(task.filePath, today, "System", [
        `Task swept by Sweeper Protocol — ${actionLabel}. ` +
        `Claim by "${task.assignee}" was ${ageHours}h old (threshold: 4h).` +
        (reason ? ` Reason: ${reason}` : ""),
      ]);
    }

    changedCount++;
  }

  let pushed = true;
  if (!dryRun && swept.length > 0 && shouldCommit) {
    pushed = await withTaskStateTransaction(
      { command: `sweep ${swept.length} task(s)`, maxRetries: 3 },
      (tx) => {
        for (const s of swept) {
          if (s.action === "review") {
            const t = tx.loadTask(s.id);
            if (t) { t.status = STATUS.REVIEW; tx.updateTask(t); tx.clearClaim(s.id); }
          } else if (s.action === "reset") {
            const t = tx.loadTask(s.id);
            if (t) { t.status = STATUS.READY; tx.updateTask(t); tx.clearClaim(s.id); }
          }
        }
      },
    ).then(() => true).catch(() => false);
  }

  return {
    scanned: tasks.length,
    stale: swept,
    changed: changedCount,
    pushed,
    dryRun,
  };
}

export async function runSweeperAndPrint(
  repoRoot?: string,
  options?: SweepOptions,
): Promise<SweepResult> {
  const result = await sweepStaleTasks(repoRoot, options);

  if (result.changed === 0) {
    logInfo("Sweeper: No stale tasks found.");
    return result;
  }

  logInfo(`Sweeper: Found ${result.stale.length} stale task(s) with claims older than 4 hours${options?.dryRun ? " (dry-run)" : ""}.`);

  for (const swept of result.stale) {
    const ageHours = (swept.ageMs / (60 * 60 * 1000)).toFixed(1);
    const actionLabel = swept.action === "review" ? "→ Review" : swept.action === "skipped" ? "— SKIPPED" : "→ Ready";
    logSub(`${swept.id} (claimed by "${swept.previousAssignee}" ${ageHours}h ago) ${actionLabel}`);
    if (swept.reason) {
      logWarn(`  ${swept.reason}`);
    }
    if (swept.action !== "skipped") {
      logSuccess(`  ${swept.id}: In Progress → ${swept.action === "review" ? "Review" : "Ready"}`);
    }
  }

  if (!result.pushed) {
    logWarn("Sweeper: failed to push state changes after retries. State changes are committed locally.");
  } else if (!options?.dryRun) {
    logSuccess(`Sweeper: Recovered ${result.changed} stale task(s).`);
  } else {
    logInfo(`Sweeper: ${result.changed} task(s) would be recovered (dry-run).`);
  }

  return result;
}
