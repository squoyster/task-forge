import { execSync } from "node:child_process";
import { readAudit, readTaskAudit, createTaskEvent, appendTaskTranscript, appendAuditEvent } from "./audit.js";
import { parseSessionIdFromBranch } from "./session.js";
import { getRepoRoot } from "../util/paths.js";


export interface CliInvocationRecord {
  timestamp: string;
  command: string;
  args: string[];
  flags: Record<string, unknown>;
  exitCode: number;
  sessionId: string | null;
  taskId: string | null;
  duration: number;
  error: string | null;
}

/**
 * Get the current agent session identifier.
 * Priority: TASKFORGE_ACTOR env var → branch session ID → null
 */
export function getCurrentSessionId(repoRoot?: string): string | null {
  const actor = process.env.TASKFORGE_ACTOR;
  if (actor) return actor;

  try {
    const root = repoRoot ?? getRepoRoot();
    const branch = getCurrentBranchSync(root);
    if (branch) {
      return parseSessionIdFromBranch(branch);
    }
  } catch {
    // Not in a git repo or branch unavailable
  }

  return null;
}

/**
 * Synchronous version of getCurrentBranch for use during CLI startup.
 */
function getCurrentBranchSync(repoRoot: string): string | null {
  try {
    return execSync("git branch --show-current", { cwd: repoRoot, encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

/**
 * Extract task ID from command arguments.
 * Many commands take a taskId as the first positional argument.
 */
function extractTaskId(command: string, args: string[]): string | null {
  const taskCommands = [
    "start", "done", "claim", "release", "heartbeat", "inspect",
    "block", "unlock", "checkpoint", "submit", "diff", "report", "reject",
    "prompt", "resume", "ac-check", "audit", "transcript", "timeline",
    "cleanup", "gates", "pr",
  ];

  if (taskCommands.includes(command) && args.length > 0) {
    const match = args[0].match(/^TASK-\d+$/i) || args[0].match(/^BUG-\d+$/i);
    if (match) return match[0].toUpperCase();
  }

  return null;
}

/**
 * Record a CLI invocation to the appropriate audit log.
 * - Per-task commands write to the task's transcript
 * - Global commands write to the global audit log
 */
export function recordCliInvocation(
  repoRoot: string,
  command: string,
  args: string[],
  flags: Record<string, unknown>,
  exitCode: number,
  duration: number,
  error: string | null,
): void {
  const sessionId = getCurrentSessionId(repoRoot);
  const taskId = extractTaskId(command, args);

  const record: CliInvocationRecord = {
    timestamp: new Date().toISOString(),
    command,
    args,
    flags,
    exitCode,
    sessionId,
    taskId,
    duration,
    error,
  };

  // Determine event type based on exit code
  const eventType = exitCode === 0
    ? "task.command.completed"
    : "task.command.failed";

  const event = createTaskEvent(taskId ?? command, eventType, {
    sessionId: sessionId ?? undefined,
    summary: `CLI: taskforge ${command} ${args.join(" ")}`,
    metadata: {
      type: "cli.invocation",
      command,
      args,
      flags,
      exitCode,
      duration,
      error,
      agentSession: sessionId,
    },
  });

  if (taskId) {
    // Per-task command — write to task transcript
    appendTaskTranscript(repoRoot, taskId, event);
  }


  // Also write to main audit events
  appendAuditEvent(repoRoot, event);
}

/**
 * Read all CLI invocations for a task from its transcript.
 */
export function readTaskInvocations(repoRoot: string, taskId: string): CliInvocationRecord[] {
  const invocations: CliInvocationRecord[] = [];

  for (const parsed of readTaskAudit(repoRoot, taskId)) {
    if (parsed.metadata?.type === "cli.invocation") {
      invocations.push({
        timestamp: parsed.timestamp,
        command: typeof parsed.metadata.command === "string" ? parsed.metadata.command : "unknown",
        args: Array.isArray(parsed.metadata.args)
          ? parsed.metadata.args.filter((value): value is string => typeof value === "string")
          : [],
        flags:
          typeof parsed.metadata.flags === "object" && parsed.metadata.flags !== null
            ? parsed.metadata.flags as Record<string, unknown>
            : {},
        exitCode: typeof parsed.metadata.exitCode === "number" ? parsed.metadata.exitCode : 0,
        sessionId: typeof parsed.metadata.agentSession === "string" ? parsed.metadata.agentSession : null,
        taskId: parsed.taskId ?? null,
        duration: typeof parsed.metadata.duration === "number" ? parsed.metadata.duration : 0,
        error: typeof parsed.metadata.error === "string" ? parsed.metadata.error : null,
      });
    }
  }

  return invocations;
}

/**
 * Read all CLI invocations from the global audit log.
 */
export function readGlobalInvocations(repoRoot: string): CliInvocationRecord[] {
  const invocations: CliInvocationRecord[] = [];

  for (const event of readAudit(repoRoot)) {
    if (event.metadata?.type !== "cli.invocation") continue;
    invocations.push({
      timestamp: event.timestamp,
      command: typeof event.metadata.command === "string" ? event.metadata.command : "unknown",
      args: Array.isArray(event.metadata.args)
        ? event.metadata.args.filter((value): value is string => typeof value === "string")
        : [],
      flags:
        typeof event.metadata.flags === "object" && event.metadata.flags !== null
          ? event.metadata.flags as Record<string, unknown>
          : {},
      exitCode: typeof event.metadata.exitCode === "number" ? event.metadata.exitCode : 0,
      sessionId: typeof event.metadata.agentSession === "string" ? event.metadata.agentSession : null,
      taskId: typeof event.taskId === "string" ? event.taskId : null,
      duration: typeof event.metadata.duration === "number" ? event.metadata.duration : 0,
      error: typeof event.metadata.error === "string" ? event.metadata.error : null,
    });
  }

  return invocations;
}

export interface TaskInvocationSummary {
  totalInvocations: number;
  uniqueCommands: string[];
}

export function summarizeTaskInvocations(repoRoot: string, taskId: string): TaskInvocationSummary {
  const invocations = readTaskInvocations(repoRoot, taskId);
  return {
    totalInvocations: invocations.length,
    uniqueCommands: [...new Set(invocations.map((invocation) => invocation.command))],
  };
}
