import { loadAllTasks } from "../core/task-store.js";
import { normalizeStatus } from "../util/status-constants.js";
import { logHeader, logSub, logDivider, logInfo } from "../util/logging.js";
import type { ParsedTask } from "../core/task-store.js";
import { successResult } from "../core/result-builder.js";
import { writeResult } from "../util/write-command-result.js";

export interface ListOptions {
  status?: string;
  priority?: string;
  type?: string;
  search?: string;
  json?: boolean;
}

interface ListJsonEntry {
  id: string;
  status: string;
  priority: string;
  type: string;
  title: string;
  agentRole?: string;
  blocked_reason?: string;
  blocked_by?: string;
  block_category?: string;
}

function matchesSearch(task: ParsedTask, search: string): boolean {
  const lower = search.toLowerCase();
  return (
    task.id.toLowerCase().includes(lower) ||
    task.body.toLowerCase().includes(lower)
  );
}

function getTitle(task: ParsedTask): string {
  const match = task.body.match(/^#\s+\S+:\s+(.+)$/m);
  return match ? match[1].trim() : task.id;
}

export function filterTasks(
  tasks: ParsedTask[],
  options: ListOptions,
): ParsedTask[] {
  // Normalize status filter if provided
  const normalizedStatus = options.status ? normalizeStatus(options.status) : undefined;

  return tasks.filter((t) => {
    if (normalizedStatus && t.status !== normalizedStatus) return false;
    if (options.priority && t.priority !== options.priority) return false;
    if (options.type && t.type !== options.type) return false;
    if (options.search && !matchesSearch(t, options.search)) return false;
    return true;
  });
}

export async function cmdList(options: ListOptions = {}): Promise<void> {
  const tasks = loadAllTasks();
  const filtered = filterTasks(tasks, options);

  if (options.json) {
    const entries: ListJsonEntry[] = filtered.map((t) => ({
      id: t.id,
      status: t.status,
      priority: t.priority,
      type: t.type,
      title: getTitle(t),
      agentRole: t.agentRole,
      blocked_reason: t.blocked_reason,
      blocked_by: t.blocked_by,
      block_category: t.block_category,
    }));
    writeResult(successResult({
      command: "list",
      guidance: `Found ${entries.length} task(s) matching criteria.`,
    }), options.json);
    return;
  }

  if (filtered.length === 0) {
    logInfo("No tasks matching criteria.");
    return;
  }

  logHeader(`## Tasks (${filtered.length})`);
  logDivider();

  for (const t of filtered) {
    const title = getTitle(t);
    logSub(`- **${t.id}** [${t.status}] (${t.priority}, ${t.type}): ${title}`);
    if (t.blocked_reason && t.status === "Blocked") {
      logSub(`  ↳ ${t.block_category !== "unspecified" ? `[${t.block_category}] ` : ""}${t.blocked_reason}`);
    }
  }

  logDivider();
}
