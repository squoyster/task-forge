import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createTaskEvent, appendTaskTranscript, appendAuditEvent } from "./audit.js";
import { parseSessionIdFromBranch } from "./session.js";
import { getRepoRoot } from "../util/paths.js";

const GLOBAL_AUDIT_FILE = "invocations.jsonl";

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
    "block", "unlock", "checkpoint", "submit", "diff", "report",
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

  // Always write to global audit log
  const globalPath = path.join(repoRoot, "logs", "taskforge", "audit", GLOBAL_AUDIT_FILE);
  const globalDir = path.dirname(globalPath);
  fs.mkdirSync(globalDir, { recursive: true });
  fs.appendFileSync(globalPath, JSON.stringify(record) + "\n", "utf-8");

  // Also write to main audit events
  appendAuditEvent(repoRoot, event);
}

/**
 * Read all CLI invocations for a task from its transcript.
 */
export function readTaskInvocations(repoRoot: string, taskId: string): CliInvocationRecord[] {
  const transcriptPath = path.join(repoRoot, "logs", "taskforge", "tasks", taskId, "transcript.jsonl");
  if (!fs.existsSync(transcriptPath)) return [];

  const content = fs.readFileSync(transcriptPath, "utf-8");
  const invocations: CliInvocationRecord[] = [];

  for (const line of content.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.metadata?.type === "cli.invocation") {
        invocations.push({
          timestamp: parsed.timestamp,
          command: parsed.metadata.command,
          args: parsed.metadata.args ?? [],
          flags: parsed.metadata.flags ?? {},
          exitCode: parsed.metadata.exitCode ?? 0,
          sessionId: parsed.metadata.agentSession ?? null,
          taskId: parsed.taskId ?? null,
          duration: parsed.metadata.duration ?? 0,
          error: parsed.metadata.error ?? null,
        });
      }
    } catch {
      // Skip invalid lines
    }
  }

  return invocations;
}

/**
 * Read all CLI invocations from the global audit log.
 */
export function readGlobalInvocations(repoRoot: string): CliInvocationRecord[] {
  const globalPath = path.join(repoRoot, "logs", "taskforge", "audit", GLOBAL_AUDIT_FILE);
  if (!fs.existsSync(globalPath)) return [];

  const content = fs.readFileSync(globalPath, "utf-8");
  const invocations: CliInvocationRecord[] = [];

  for (const line of content.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      invocations.push(JSON.parse(line) as CliInvocationRecord);
    } catch {
      // Skip invalid lines
    }
  }

  return invocations;
}
