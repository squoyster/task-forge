import { loadAllTasks, updateTaskStatus, clearTaskLock, appendAgentNote } from "../core/task-store.js";
import { getRepoRoot } from "../util/paths.js";
import { commitAndPushTaskState } from "../core/git.js";
import { logInfo, logSuccess, logSub } from "../util/logging.js";

const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Sweeper Protocol: scan all in_progress tasks for stale claims.
 * A claim is stale if claimed_at is older than 4 hours.
 * Stale tasks are reset to Ready with assignee/claimed_at cleared.
 */
export async function cmdSweep(): Promise<void> {
  const repoRoot = getRepoRoot();
  const tasks = loadAllTasks(repoRoot);

  const staleTasks = tasks.filter((t) => {
    if (t.status !== "In Progress") return false;
    if (!t.assignee || !t.claimed_at) return false;

    const claimedTime = parseClaimedAt(t.claimed_at);
    if (!claimedTime) return false;

    const age = Date.now() - claimedTime.getTime();
    return age > STALE_THRESHOLD_MS;
  });

  if (staleTasks.length === 0) {
    logInfo("Sweeper: No stale tasks found.");
    return;
  }

  logInfo(`Sweeper: Found ${staleTasks.length} stale task(s) with claims older than 4 hours.`);

  for (const task of staleTasks) {
    const ageHours = ((Date.now() - parseClaimedAt(task.claimed_at!)!.getTime()) / (60 * 60 * 1000)).toFixed(1);
    logSub(`Resetting ${task.id} (claimed by "${task.assignee}" ${ageHours}h ago)`);

    // Reset to Ready
    updateTaskStatus(task.filePath, "Ready");
    // Clear the claim
    clearTaskLock(task.filePath);

    const today = new Date().toISOString().split("T")[0];
    appendAgentNote(task.filePath, today, "System", [
      `Task swept by Sweeper Protocol — claim by "${task.assignee}" was ${ageHours}h old (threshold: 4h)`,
    ]);

    logSuccess(`  ${task.id}: In Progress → Ready (claim cleared)`);
  }

  // Push all state changes to the task-state branch
  await commitAndPushTaskState(repoRoot, `chore: sweep ${staleTasks.length} stale task(s)`);

  logSuccess(`Sweeper: Recovered ${staleTasks.length} stale task(s).`);
}

function parseClaimedAt(value: string | Date): Date | null {
  // If already a Date object (js-yaml auto-parses timestamps)
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  const str = value as string;

  // Try YYYY-MM-DD HH:MM:SS format (our YAML-safe format).
  // IMPORTANT: this must be checked BEFORE Date.parse, because
  // Date.parse interprets this format as LOCAL time, but our stored
  // timestamps are UTC-based. Date.UTC below ensures correct parsing.
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, year, month, day, hour, min, sec] = match.map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour, min, sec));
  }

  // Fallback: try standard ISO format
  const iso = Date.parse(str);
  if (!isNaN(iso)) return new Date(iso);

  return null;
}
