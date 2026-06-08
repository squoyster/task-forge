import type { StateValidationIssue } from "../core/state-validator.js";

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
  exists?: boolean;
}

export type Safety = "safe" | "requires_human" | "doctor_only" | "blocked";

export interface NextAction {
  command: string;
  reason: string;
  safety: Safety;
  preferred: boolean;
  stateTransition?: { from: string; to: string };
}

export interface JsonNext {
  command?: string;
}

export interface JsonResult {
  ok: boolean;
  task?: JsonTask;
  workspace?: JsonWorkspace;
  next?: JsonNext;
  nextActions?: Array<string | NextAction>;
  guidance?: string;
  error?: string;
  code?: string;
  errors?: StateValidationIssue[];
  warnings?: StateValidationIssue[];
  sweep?: { scanned: number; stale: number; changed: number; dryRun?: boolean; actions?: Array<{ taskId: string; previousAssignee: string; ageHours: string; action: string; reason?: string }> };
  gates?: GateResult[];
  allPassed?: boolean;
  issues?: Array<{ taskId: string; type: string; message: string }>;
  total?: number;
  scanned?: number;
  recovery?: { method: string; sessionId: string; claimedAt: string };
  registry?: { active: Array<Record<string, unknown>>; idle: Array<Record<string, unknown>>; crashed: Array<Record<string, unknown>>; maxConcurrentAgents: number; agentHistoryCount: number; lastUpdated: string };
  summary?: { total: number; active: number; idle: number; crashed: number };
  stale?: Array<Record<string, unknown>>;
  recovered?: Array<Record<string, unknown>>;
  count?: number;
  thresholdMinutes?: number;
  preconditions?: Array<{ name: string; passed: boolean; message: string; code: string }>;
  suggestedStatus?: string;
  deniedCommands?: string[];
  readOnlyCommands?: string[];
  message?: string;
  override?: Record<string, unknown>;
  managed?: boolean;
  envVar?: string;
  doctorOverrideAvailable?: boolean;
  doctorOverrideExists?: boolean;
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
export function jsonError(error: string, code?: string, extras?: Partial<JsonResult>): JsonResult {
  return {
    ok: false,
    error,
    code,
    ...extras,
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