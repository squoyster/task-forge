import type { ParsedTask } from "./task-store.js";
import { STATUS, ACTIVE_STATUSES } from "../util/status-constants.js";
import { logWarn } from "../util/logging.js";

const STATUS_PRIORITY: Record<string, number> = {
  [STATUS.IN_PROGRESS]: 7,
  [STATUS.VERIFY]: 6,
  [STATUS.REVIEW]: 5,
  [STATUS.READY]: 4,
  [STATUS.BLOCKED]: 0,
  [STATUS.INBOX]: 0,
  [STATUS.NEEDS_SPEC]: 0,
  [STATUS.DONE]: 0,
  [STATUS.REJECTED]: 0,
  [STATUS.DEFERRED]: 0,
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

/**
 * Check whether a task has any dependencies that are not yet Done.
 * A task with no dependsOn field has no dependencies.
 */
export function hasUnmetDependencies(task: ParsedTask, allTasks: ParsedTask[]): string[] {
  if (!task.dependsOn || task.dependsOn.length === 0) return [];

  const unmet: string[] = [];
  for (const depId of task.dependsOn) {
    const dep = allTasks.find((t) => t.id === depId);
    if (!dep) {
      unmet.push(depId);
    } else if (dep.status !== STATUS.DONE && dep.status !== STATUS.REJECTED && dep.status !== STATUS.DEFERRED) {
      unmet.push(depId);
    }
  }
  return unmet;
}

/**
 * Find all tasks that depend on the given task ID.
 */
export function getDependents(taskId: string, allTasks: ParsedTask[]): ParsedTask[] {
  return allTasks.filter(
    (t) => t.dependsOn && t.dependsOn.includes(taskId),
  );
}

/**
 * Detect circular dependencies among tasks.
 * Returns a list of cycle descriptions. Does not throw.
 */
export function detectCircularDependencies(tasks: ParsedTask[]): string[] {
  const cycles: string[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string, path: string[]): void {
    if (inStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cycle = [...path.slice(cycleStart), nodeId];
      cycles.push(`Circular dependency: ${cycle.join(" → ")}`);
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    const task = tasks.find((t) => t.id === nodeId);
    if (task?.dependsOn) {
      for (const depId of task.dependsOn) {
        if (tasks.some((t) => t.id === depId)) {
          dfs(depId, path);
        }
      }
    }

    path.pop();
    inStack.delete(nodeId);
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id, []);
    }
  }

  return cycles;
}

/**
 * Run circular dependency detection and log warnings.
 */
export function warnOnCircularDependencies(tasks: ParsedTask[]): void {
  const cycles = detectCircularDependencies(tasks);
  for (const cycle of cycles) {
    logWarn(cycle);
  }
}

export function selectNextTask(tasks: ParsedTask[]): ParsedTask | null {
  // Run circular dependency detection but don't block selection
  warnOnCircularDependencies(tasks);

  const actionable = tasks.filter(
    (t) =>
      ACTIVE_STATUSES.includes(t.status as never) &&
      hasUnmetDependencies(t, tasks).length === 0,
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
