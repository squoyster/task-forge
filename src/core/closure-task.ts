import { execa } from "execa";
import { getRepoRoot } from "../util/paths.js";

export type ClosureCategory =
  | "UNKNOWN_STATE"
  | "UNMAPPED_ERROR"
  | "UNSUPPORTED_TRANSITION"
  | "MISSING_RECOVERY_COMMAND";

export interface ClosureContext {
  command: string;
  taskId?: string;
  status?: string;
  branch?: string;
  worktree?: string;
  errorCode?: string;
  errorMessage?: string;
  observedState?: Record<string, unknown>;
}

interface ClosureTaskSpawnResult {
  created: boolean;
  taskId?: string;
}

function normalizeSummary(summary: string): string {
  return summary.replace(/\s+/g, " ").trim();
}

function truncateSummary(summary: string, maxLength = 96): string {
  const normalized = normalizeSummary(summary);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildTaskTitle(category: ClosureCategory, summary: string): string {
  const prefix = category === "UNMAPPED_ERROR" ? "error" : "state";
  return `Handle unclosed TaskForge ${prefix}: ${truncateSummary(summary)}`;
}

function safeSerialize(value: unknown): string {
  if (value === undefined) return "undefined";
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_key, current) => {
      if (typeof current === "function") return "[Function]";
      if (typeof current === "bigint") return current.toString();
      if (typeof current === "symbol") return current.toString();
      if (current && typeof current === "object") {
        if (seen.has(current)) return "[Circular]";
        seen.add(current);
      }
      return current;
    },
    2,
  ) ?? "null";
}

function buildClosureTaskBody(
  category: ClosureCategory,
  summary: string,
  context: ClosureContext,
): string {
  const observedState = context.observedState ?? {
    command: context.command,
    taskId: context.taskId,
    status: context.status,
    branch: context.branch,
    worktree: context.worktree,
    errorCode: context.errorCode,
    errorMessage: context.errorMessage,
  };

  return [
    "## Goal",
    `Close the TaskForge gap described by this ${category.toLowerCase().replace(/_/g, " ")}.`,
    "",
    "## Background",
    `Command: ${context.command}`,
    `Task: ${context.taskId ?? "none"}`,
    `Status: ${context.status ?? "unknown"}`,
    `Branch: ${context.branch ?? "unknown"}`,
    `Worktree: ${context.worktree ?? "unknown"}`,
    `Error code: ${context.errorCode ?? "none"}`,
    `Error message: ${context.errorMessage ?? summary}`,
    "",
    "## Observed State",
    "```json",
    safeSerialize(observedState),
    "```",
    "",
    "## Scope",
    "Define the missing invariant, recovery path, and valid next actions for this condition.",
    "",
    "## Acceptance Criteria",
    `- [ ] ${summary}.`,
    "- [ ] The command/state machine returns explicit, structured next actions.",
    "- [ ] TaskForge does not recurse into closure-task creation if taskforge new fails.",
    "- [ ] Tests cover the unhandled state and recovery path.",
    "",
    "## Expected Recovery Behavior",
    "The command should surface a safe `taskforge new` instruction and, when enabled, create the closure task without bypassing TaskForge.",
  ].join("\n");
}

function shellQuote(value: string): string {
  if (value.length === 0) return "''";
  return `'${value.split("'").join(`'"'"'`)}'`;
}

function formatShellArg(value: string): string {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) return value;
  return shellQuote(value);
}

function buildNewTaskArgs(category: ClosureCategory, summary: string, context: ClosureContext): string[] {
  return [
    "new",
    buildTaskTitle(category, summary),
    "--type",
    "Bug",
    "--priority",
    "P1",
    "--status",
    "Ready",
    "--body",
    buildClosureTaskBody(category, summary, context),
  ];
}

export function createClosureTaskCommand(
  category: ClosureCategory,
  summary: string,
  context: ClosureContext,
): string {
  const args = buildNewTaskArgs(category, summary, context);
  const quoted = args.map((arg) => formatShellArg(arg));
  return [`taskforge`, ...quoted].join(" ");
}

export async function maybeAutoCreateClosureTask(
  category: ClosureCategory,
  summary: string,
  context: ClosureContext,
): Promise<ClosureTaskSpawnResult> {
  if (process.env.TASKFORGE_CLOSURE_TASK_ACTIVE === "1") {
    return { created: false };
  }

  if (context.command === "new") {
    return { created: false };
  }

  const repoRoot = getRepoRoot();
  const env = {
    ...process.env,
    TASKFORGE_CLOSURE_TASK_ACTIVE: "1",
  };

  const args = [
    "--import",
    "tsx",
    "src/cli.ts",
    ...buildNewTaskArgs(category, summary, context),
    "--json",
  ];

  const result = await execa("node", args, {
    cwd: repoRoot,
    env,
    reject: false,
  });

  if (result.exitCode !== 0 || !result.stdout) {
    return { created: false };
  }

  try {
    const parsed = JSON.parse(result.stdout) as {
      ok?: boolean;
      context?: { taskId?: string };
      task?: { id?: string };
    };
    if (!parsed.ok) {
      return { created: false };
    }
    return {
      created: true,
      taskId: parsed.context?.taskId ?? parsed.task?.id,
    };
  } catch {
    return { created: false };
  }
}
