import type { ParsedTask } from "./task-store.js";

const STATUS_PRIORITY: Record<string, number> = {
  "In Progress": 7,
  Verify: 6,
  Review: 5,
  Ready: 4,
  Blocked: 0,
  Inbox: 0,
  "Needs Spec": 0,
  Done: 0,
  Rejected: 0,
  Deferred: 0,
};

const PRIORITY_WEIGHT: Record<string, number> = {
  P0: 40,
  P1: 30,
  P2: 20,
  P3: 10,
};

export function scoreTask(task: ParsedTask): number {
  const statusScore = STATUS_PRIORITY[task.status] ?? 0;
  const priorityScore = PRIORITY_WEIGHT[task.priority] ?? 0;
  return statusScore * 100 + priorityScore;
}

export function selectNextTask(tasks: ParsedTask[]): ParsedTask | null {
  const actionable = tasks.filter(
    (t) =>
      t.status === "In Progress" ||
      t.status === "Verify" ||
      t.status === "Review" ||
      t.status === "Ready",
  );

  if (actionable.length === 0) return null;

  actionable.sort((a, b) => scoreTask(b) - scoreTask(a));
  return actionable[0];
}

export function getTasksByStatus(
  tasks: ParsedTask[],
): Record<string, ParsedTask[]> {
  const grouped: Record<string, ParsedTask[]> = {};
  for (const task of tasks) {
    if (!grouped[task.status]) {
      grouped[task.status] = [];
    }
    grouped[task.status].push(task);
  }
  return grouped;
}
