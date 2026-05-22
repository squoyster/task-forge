/**
 * Convert a canonical STATUS value to snake_case for JSON output.
 * e.g. "In Progress" → "in_progress", "Needs Spec" → "needs_spec"
 */
export function statusToJson(status: string): string {
  return status
    .toLowerCase()
    .replace(/ /g, "_");
}

export interface JsonTask {
  id: string;
  status: string;        // snake_case for machine consumption
  statusLabel: string;   // human-readable canonical form
  priority: string;
  title: string;
}

export interface JsonWorkspace {
  branch?: string;
  worktree?: string;
}

export interface JsonNext {
  command?: string;
}

export interface JsonResult {
  ok: boolean;
  task?: JsonTask;
  workspace?: JsonWorkspace;
  next?: JsonNext;
  error?: string;
  code?: string;
  sweep?: { scanned: number; stale: number; changed: number };
  gates?: GateResult[];
  allPassed?: boolean;
}

export interface GateResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  command: string;
}

/**
 * Create a success JSON result.
 */
export function jsonOk(overrides?: Partial<JsonResult>): JsonResult {
  return {
    ok: true,
    ...overrides,
  };
}

/**
 * Create an error JSON result.
 */
export function jsonError(error: string, code?: string): JsonResult {
  return {
    ok: false,
    error,
    code,
  };
}

/**
 * Build a JsonTask from a task-like object.
 */
export function buildJsonTask(task: {
  id: string;
  status: string;
  priority: string;
  body: string;
}): JsonTask {
  const titleMatch = task.body.match(/^#\s+\S+:\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : task.id;
  return {
    id: task.id,
    status: statusToJson(task.status),
    statusLabel: task.status,
    priority: task.priority,
    title,
  };
}

/**
 * Print a JSON result object to stdout.
 */
export function printJson(result: JsonResult): void {
  console.log(JSON.stringify(result, null, 2));
}