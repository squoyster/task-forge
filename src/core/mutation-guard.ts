/**
 * Mutation Guard — defense-in-depth enforcement of the TaskForge mutation boundary.
 *
 * When TASK_FORGE_ACTIVE is set, implementation agents are denied raw Git
 * mutation commands and direct task-state file edits.  They must use TaskForge
 * lifecycle commands instead.  Read-only Git diagnostics remain available.
 *
 * Override: a Human or Doctor may authorise specific mutations through a
 * structured, auditable override mechanism.
 */
import path from "node:path";
import fs from "node:fs";
import { getTaskStateDir, getRepoRoot } from "../util/paths.js";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/**
 * Check whether the current session is a managed agent session.
 */
/**
 * Check whether the current session is a managed agent session.
 *
 * Returns true when the environment variable TASK_FORCE_ACTIVE is set to "true".
 * Can be overridden for testing via _setTestManagedSession.
 */
export function isManagedSession(
  envOverride?: Record<string, string | undefined>,
): boolean {
  if (_testOverrideManagedSession !== undefined) {
    return _testOverrideManagedSession;
  }
  // Read from provided env or default to process.env
  const env = envOverride ?? (typeof process !== "undefined" ? process.env : {});
  return env["TASK_FORCE_ACTIVE"] === "true";
}

/** @internal test support */
export let _testOverrideManagedSession: boolean | undefined;
export function _setTestManagedSession(val: boolean | undefined): void {
  _testOverrideManagedSession = val;
}
export function _resetTestManagedSession(): void {
  _testOverrideManagedSession = undefined;
}

// ---------------------------------------------------------------------------
// Git command classification
// ---------------------------------------------------------------------------

/**
 * Git commands that mutate repository state and are DENIED to managed agents.
 *
 * Each entry can be either:
 * - A simple command name (e.g. "commit") — matches any `git <name> …` form
 * - A command + subcommand pair (e.g. "branch -d") — matches `git branch -d …`
 */
export const DENIED_GIT_COMMANDS: string[] = [
  "commit",
  "push",
  "merge",
  "rebase",
  "cherry-pick",
  "reset",
  "branch -d",
  "branch -D",
  "branch --delete",
  "update-ref",
  "worktree add",
  "worktree remove",
  "worktree prune",
  "rm",
  "mv",
  "tag -d",
  "tag --delete",
  "gc",
  "prune",
  "clean",
];

/**
 * Git commands that are considered read-only and ALLOWED for managed agents.
 */
export const READ_ONLY_GIT_COMMANDS: string[] = [
  "status",
  "diff",
  "log",
  "show",
  "rev-parse",
  "merge-base",
  "ls-remote",
  "fetch",
  "remote",
  "config",
  "help",
  "version",
  "symbolic-ref",
  "describe",
  "ls-files",
  "ls-tree",
  "cat-file",
];

/**
 * Result of a mutation check.
 */
export interface MutationCheckResult {
  allowed: boolean;
  reason?: string;
  replacement?: string;
  code: "ALLOWED" | "DENIED_COMMAND" | "DENIED_TASK_STATE_EDIT" | "NOT_MANAGED";
}

// ---------------------------------------------------------------------------
// Command parsing helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a command string by collapsing whitespace and lower-casing the
 * verb.  Strips leading path elements that look like absolute git paths.
 *
 * Examples:
 *   "git commit -m foo"        →  "git commit -m foo"
 *   "/usr/bin/git push origin" →  "git push origin"
 *   "git branch -D foo"        →  "git branch -d foo"
 */
export function normaliseCommand(raw: string): string {
  let cmd = raw.trim();

  // Strip leading directory if it looks like an absolute path to git
  // e.g. /usr/bin/git, /opt/homebrew/bin/git
  cmd = cmd.replace(/^(?:\/[^\s]+)+\/git(\s|$)/, "git$1");

  // Collapse whitespace
  cmd = cmd.replace(/\s+/g, " ");

  return cmd;
}

/**
 * Extract the verb (and first sub-verb) from a normalised command.
 *
 * "git commit -m foo"  →  { verb: "commit", sub: undefined }
 * "git branch -d foo"  →  { verb: "branch", sub: "-d" }
 * "/bin/rm file"       →  { verb: "rm", sub: undefined }
 */
export function parseGitCommand(
  normalised: string,
): { verb?: string; sub?: string; args: string[] } {
  const parts = normalised.split(" ");

  // Must start with "git"
  if (parts[0] !== "git") return { args: parts };

  const verb = parts[1];
  // sub is parts[2] regardless of whether it starts with "-" or not
  // (handles both "git branch -d foo" and "git worktree add ../tree")
  const sub = parts[2] ? parts[2] : undefined;
  const args = parts.slice(3);

  // Normalise -D to -d, --delete to -d for matching
  const normalisedSub = sub
    ?.replace("-D", "-d")
    .replace("--delete", "-d");

  return { verb, sub: normalisedSub, args };
}

// ---------------------------------------------------------------------------
// Denied command matching
// ---------------------------------------------------------------------------

/**
 * Check whether a normalised git command matches a denied pattern.
 *
 * A pattern like "branch -d" matches `git branch -d foo` but not
 * `git branch`.
 */
export function isDeniedGitCommand(normalised: string): {
  denied: boolean;
  match?: string;
} {
  const { verb, sub } = parseGitCommand(normalised);
  if (!verb) return { denied: false };

  // Check exact match first (e.g. "commit" matches "commit")
  if (DENIED_GIT_COMMANDS.includes(verb)) {
    return { denied: true, match: verb };
  }

  // Check verb + sub (e.g. "branch -d" matches "git branch -d foo")
  if (sub) {
    const combined = `${verb} ${sub}`;
    if (DENIED_GIT_COMMANDS.includes(combined)) {
      return { denied: true, match: combined };
    }
  }

  // Broad match: `git push` matches even if args differ
  // This catches aliases and wrappers that invoke git with similar intent
  if (verb === "push") return { denied: true, match: "push" };
  if (verb === "commit") return { denied: true, match: "commit" };

  return { denied: false };
}

/**
 * Check whether a normalised git command is read-only.
 */
export function isReadOnlyGitCommand(normalised: string): boolean {
  const { verb, sub } = parseGitCommand(normalised);
  if (!verb) return false;

  // Some verbs in the read-only list can also be used for mutations
  // (e.g. "git branch -d" is denied but "git branch" is read-only).
  // Check for denied patterns first.
  if (verb === "branch") {
    // deny: -d, -D, --delete
    // allow: no flags, --show-current, -a, -r, -v, --list
    if (!sub || sub === "--show-current" || sub === "-a" || sub === "-r" || sub === "-v" || sub === "--list") {
      return true;
    }
    return false;
  }

  // `git fetch` is in the read-only list
  if (READ_ONLY_GIT_COMMANDS.includes(verb)) {
    return true;
  }

  // Help and version are always allowed
  if (verb === "help" || verb === "version") return true;

  return false;
}

// ---------------------------------------------------------------------------
// Replacement suggestions
// ---------------------------------------------------------------------------

/**
 * Map of denied git commands to their TaskForge replacements.
 */
// ponytail: git commit/push have no TaskForge facade replacement (facade removed).
// The guard still denies them in managed sessions via isDeniedGitCommand();
// only the suggestion text is absent.
const REPLACEMENTS: Record<string, string> = {
  "branch -d": "taskforge done TASK-ID --delete-branch",
  "branch -D": "taskforge done TASK-ID --delete-branch",
  "branch --delete": "taskforge done TASK-ID --delete-branch",
  "worktree add": "taskforge start TASK-ID",
  "worktree remove": "taskforge done TASK-ID --cleanup",
};

export function getReplacement(match: string): string | undefined {
  return REPLACEMENTS[match];
}

// ---------------------------------------------------------------------------
// Task-state file guard
// ---------------------------------------------------------------------------

/**
 * Check whether a file path targets a managed task-state file.
 */
export function isTaskStateFile(filePath: string): boolean {
  const stateDir = getTaskStateDir(getRepoRoot());
  const resolved = path.resolve(filePath);
  return resolved.startsWith(stateDir);
}

/**
 * Check whether a command attempts to modify task-state files.
 */
export function isTaskStateEditCommand(normalised: string): boolean {
  // Check for redirection/writing to task-state paths
  const lower = normalised.toLowerCase();
  if (lower.includes("task-state") || lower.includes("tasks/")) {
    // Writing commands (echo, cat, sed, tee, cp, mv, etc.) to task-state
    const writeTools = ["echo", "cat", "sed", "tee", "cp", "mv", "rm", ">>", ">"];
    if (writeTools.some((t) => lower.includes(t))) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Check whether a command is allowed under the mutation boundary.
 *
 * @param rawCommand - The full command string to check.
 * @param envOverride - Optional environment override (used for testing).
 *
 * Returns:
 *   - NOT_MANAGED if TASK_FORCE_ACTIVE is not set
 *   - ALLOWED if the command is read-only or not a mutation
 *   - DENIED_COMMAND if the command is a denied mutation
 *   - DENIED_TASK_STATE_EDIT if the command edits task-state files
 */
export function checkMutationAllowed(
  rawCommand: string,
  envOverride?: Record<string, string | undefined>,
): MutationCheckResult {
  if (!isManagedSession(envOverride)) {
    return { allowed: true, code: "NOT_MANAGED" };
  }

  const normalised = normaliseCommand(rawCommand);

  // Check for task-state file edits
  if (isTaskStateEditCommand(normalised)) {
    return {
      allowed: false,
      code: "DENIED_TASK_STATE_EDIT",
      reason: "Direct task-state file edits are forbidden. Use TaskForge CLI commands instead.",
      replacement: "taskforge update TASK-ID",
    };
  }

  // If it's not a git command, allow it (non-git operations are not guarded)
  if (!normalised.startsWith("git")) {
    return { allowed: true, code: "ALLOWED" };
  }

  // Check read-only commands first
  if (isReadOnlyGitCommand(normalised)) {
    return { allowed: true, code: "ALLOWED" };
  }

  // Check denied commands
  const { denied, match } = isDeniedGitCommand(normalised);
  if (denied && match) {
    const replacement = getReplacement(match);
    return {
      allowed: false,
      code: "DENIED_COMMAND",
      reason: `Raw git mutation "${match}" is forbidden in managed sessions. Use TaskForge lifecycle commands.`,
      replacement,
    };
  }

  // Unknown git command — allow it (it might be a new diagnostic we haven't listed)
  return { allowed: true, code: "ALLOWED" };
}

// ---------------------------------------------------------------------------
// Override support
// ---------------------------------------------------------------------------

/**
 * Data required for a mutation override.
 */
export interface OverrideRequest {
  reason: string;
  identity: "human" | "doctor";
  taskId: string;
  command: string;
  affectedRepo: string;
  beforeSha?: string;
  afterSha?: string;
  timestamp: string;
}

/**
 * Path to the override audit log.
 */
export function getOverrideLogPath(): string {
  const stateDir = getTaskStateDir(getRepoRoot());
  return path.join(stateDir, ".override-audit.jsonl");
}

/**
 * Record an override audit event.
 */
export function recordOverride(request: OverrideRequest): void {
  const logPath = getOverrideLogPath();
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const line = JSON.stringify(request) + "\n";
  fs.appendFileSync(logPath, line, "utf-8");
}

/**
 * Check whether an override is currently active for the given task.
 * Overrides are one-shot and not persisted beyond the audit log.
 * This is a helper for the guard to check if an override exists.
 */
export function hasOverride(taskId: string, command: string): boolean {
  const logPath = getOverrideLogPath();
  if (!fs.existsSync(logPath)) return false;

  try {
    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    // Overrides are valid for 5 minutes
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry: OverrideRequest = JSON.parse(lines[i]);
        if (entry.taskId === taskId && entry.command === command) {
          const entryTime = new Date(entry.timestamp).getTime();
          if (entryTime >= fiveMinAgo) return true;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return false;
  }
  return false;
}
