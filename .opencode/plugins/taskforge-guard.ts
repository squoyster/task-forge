// TaskForge Guard Plugin — managed by taskforge init
// Do not edit directly. Re-run 'taskforge init' to update.
// Policy: managed (mode: block)

import type { Plugin } from "opencode";

// --- Denied git mutation commands ---
const DENIED: string[] = ["commit","push","merge","rebase","cherry-pick","reset","branch -d","branch -D","branch --delete","update-ref","worktree add","worktree remove","worktree prune","rm","mv","tag -d","tag --delete","gc","prune","clean"];

// --- Read-only git commands ---
const READ_ONLY: string[] = ["status","diff","log","show","rev-parse","merge-base","ls-remote","fetch","remote","config","help","version","symbolic-ref","describe","ls-files","ls-tree","cat-file"];

// --- Replacement map ---
const REPLACEMENTS: Record<string, string> = {
  commit: "taskforge checkpoint TASK-ID --message \"…\"",
  push: "taskforge submit TASK-ID",
  "branch -d": "taskforge done TASK-ID --delete-branch",
  "branch -D": "taskforge done TASK-ID --delete-branch",
  "branch --delete": "taskforge done TASK-ID --delete-branch",
  "worktree add": "taskforge start TASK-ID",
  "worktree remove": "taskforge done TASK-ID --cleanup",
};

// --- Helpers ---

function isManagedSession(): boolean {
  return process.env.TASK_FORGE_ACTIVE === "true";
}

function checkDoctorLock(): string | null {
  try {
    // The doctor lock lives in the task-state directory
    const stateDir = process.env.TASKFORGE_STATE_DIR || "../task-state";
    const lockPath = stateDir + "/.doctor-lock";
    const fs = require("fs");
    if (fs.existsSync(lockPath)) {
      return "Doctor lock is active — normal agents must pause until recovery is complete";
    }
  } catch {}
  return null;
}

function normalise(cmd: string): string {
  return cmd
    .trim()
    .replace(/^(?:\/[^\s]+)+\/git(\s|$)/, "git$1")
    .replace(/\s+/g, " ");
}

function parseVerb(normalised: string): { verb?: string; sub?: string } {
  const parts = normalised.split(" ");
  if (parts[0] !== "git") return {};
  const verb = parts[1];
  const sub = parts[2]?.replace("-D", "-d");
  return { verb, sub };
}

function isDenied(normalised: string): string | null {
  const { verb, sub } = parseVerb(normalised);
  if (!verb) return null;
  if (DENIED.includes(verb)) return verb;
  if (sub) {
    const combined = verb + " " + sub;
    if (DENIED.includes(combined)) return combined;
  }
  if (verb === "push") return "push";
  if (verb === "commit") return "commit";
  return null;
}

function isReadOnly(normalised: string): boolean {
  const { verb, sub } = parseVerb(normalised);
  if (!verb) return false;
  if (verb === "branch" && (!sub || sub === "--show-current" || sub === "-a" || sub === "-r")) return true;
  if (READ_ONLY.includes(verb)) return true;
  return false;
}

function hasBlock(command: string): { blocked: boolean; reason?: string; replacement?: string } {
  const c = command.trim();

  // Non-managed sessions are not restricted
  if (!isManagedSession()) return { blocked: false };

  // Doctor lock check
  const doctorLockReason = checkDoctorLock();
  if (doctorLockReason) {
    return { blocked: true, reason: doctorLockReason };
  }

  // Task-state file edit detection
  if (c.match(/^(echo|cat|sed|tee|cp|mv|rm|>>|>|python|node|perl).*task-state/)) {
    return {
      blocked: true,
      reason: "Direct task-state file edits are forbidden. Use TaskForge CLI commands instead.",
      replacement: "taskforge update TASK-ID",
    };
  }

  // Non-git commands are not guarded
  if (!c.startsWith("git")) return { blocked: false };

  const normalised = normalise(c);

  // Read-only commands are allowed
  if (isReadOnly(normalised)) return { blocked: false };

  // Denied commands
  const match = isDenied(normalised);
  if (match) {
    const replacement = REPLACEMENTS[match];
    return {
      blocked: true,
      reason: `Raw git mutation "${match}" is forbidden in managed sessions. Use TaskForge lifecycle commands.`,
      replacement,
    };
  }

  return { blocked: false };
}

const taskforgeGuard: Plugin = {
  name: "taskforge-guard",
  version: "2.0.0",

  async onBeforeToolExecute(ctx: { tool: string; command?: string }): Promise<{ allow: boolean; reason?: string } | void> {
    const command = ctx.command ?? "";

    const block = hasBlock(command);
    if (block.blocked) {
      const msg = block.reason + (block.replacement ? ` Suggested: ${block.replacement}` : "");
      if (true) {
        return { allow: false, reason: msg };
      }
      // warn mode: allow but explain
      return { allow: true, reason: "WARNING: " + msg };
    }

    return;
  },
};

export default taskforgeGuard;
