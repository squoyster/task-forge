import {
  getRepoRoot,
  getTaskStateDir
} from "./chunk-46G2ACH2.js";

// src/core/mutation-guard.ts
import path from "path";
import fs from "fs";
function isManagedSession(envOverride) {
  if (_testOverrideManagedSession !== void 0) {
    return _testOverrideManagedSession;
  }
  const env = envOverride ?? (typeof process !== "undefined" ? process.env : {});
  return env["TASK_FORCE_ACTIVE"] === "true";
}
var _testOverrideManagedSession;
var DENIED_GIT_COMMANDS = [
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
  "clean"
];
var READ_ONLY_GIT_COMMANDS = [
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
  "cat-file"
];
function normaliseCommand(raw) {
  let cmd = raw.trim();
  cmd = cmd.replace(/^(?:\/[^\s]+)+\/git(\s|$)/, "git$1");
  cmd = cmd.replace(/\s+/g, " ");
  return cmd;
}
function parseGitCommand(normalised) {
  const parts = normalised.split(" ");
  if (parts[0] !== "git") return { args: parts };
  const verb = parts[1];
  const sub = parts[2] ? parts[2] : void 0;
  const args = parts.slice(3);
  const normalisedSub = sub?.replace("-D", "-d").replace("--delete", "-d");
  return { verb, sub: normalisedSub, args };
}
function isDeniedGitCommand(normalised) {
  const { verb, sub } = parseGitCommand(normalised);
  if (!verb) return { denied: false };
  if (DENIED_GIT_COMMANDS.includes(verb)) {
    return { denied: true, match: verb };
  }
  if (sub) {
    const combined = `${verb} ${sub}`;
    if (DENIED_GIT_COMMANDS.includes(combined)) {
      return { denied: true, match: combined };
    }
  }
  if (verb === "push") return { denied: true, match: "push" };
  if (verb === "commit") return { denied: true, match: "commit" };
  return { denied: false };
}
function isReadOnlyGitCommand(normalised) {
  const { verb, sub } = parseGitCommand(normalised);
  if (!verb) return false;
  if (verb === "branch") {
    if (!sub || sub === "--show-current" || sub === "-a" || sub === "-r" || sub === "-v" || sub === "--list") {
      return true;
    }
    return false;
  }
  if (READ_ONLY_GIT_COMMANDS.includes(verb)) {
    return true;
  }
  if (verb === "help" || verb === "version") return true;
  return false;
}
var REPLACEMENTS = {
  commit: 'taskforge checkpoint TASK-ID --message "..."',
  push: "taskforge submit TASK-ID",
  "branch -d": "taskforge done TASK-ID --delete-branch",
  "branch -D": "taskforge done TASK-ID --delete-branch",
  "branch --delete": "taskforge done TASK-ID --delete-branch",
  "worktree add": "taskforge start TASK-ID",
  "worktree remove": "taskforge done TASK-ID --cleanup"
};
function getReplacement(match) {
  return REPLACEMENTS[match];
}
function isTaskStateEditCommand(normalised) {
  const lower = normalised.toLowerCase();
  if (lower.includes("task-state") || lower.includes("tasks/")) {
    const writeTools = ["echo", "cat", "sed", "tee", "cp", "mv", "rm", ">>", ">"];
    if (writeTools.some((t) => lower.includes(t))) {
      return true;
    }
  }
  return false;
}
function checkMutationAllowed(rawCommand, envOverride) {
  if (!isManagedSession(envOverride)) {
    return { allowed: true, code: "NOT_MANAGED" };
  }
  const normalised = normaliseCommand(rawCommand);
  if (isTaskStateEditCommand(normalised)) {
    return {
      allowed: false,
      code: "DENIED_TASK_STATE_EDIT",
      reason: "Direct task-state file edits are forbidden. Use TaskForge CLI commands instead.",
      replacement: "taskforge update TASK-ID"
    };
  }
  if (!normalised.startsWith("git")) {
    return { allowed: true, code: "ALLOWED" };
  }
  if (isReadOnlyGitCommand(normalised)) {
    return { allowed: true, code: "ALLOWED" };
  }
  const { denied, match } = isDeniedGitCommand(normalised);
  if (denied && match) {
    const replacement = getReplacement(match);
    return {
      allowed: false,
      code: "DENIED_COMMAND",
      reason: `Raw git mutation "${match}" is forbidden in managed sessions. Use TaskForge lifecycle commands.`,
      replacement
    };
  }
  return { allowed: true, code: "ALLOWED" };
}
function getOverrideLogPath() {
  const stateDir = getTaskStateDir(getRepoRoot());
  return path.join(stateDir, ".override-audit.jsonl");
}
function recordOverride(request) {
  const logPath = getOverrideLogPath();
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const line = JSON.stringify(request) + "\n";
  fs.appendFileSync(logPath, line, "utf-8");
}

export {
  isManagedSession,
  DENIED_GIT_COMMANDS,
  READ_ONLY_GIT_COMMANDS,
  checkMutationAllowed,
  recordOverride
};
//# sourceMappingURL=chunk-AYOSERB3.js.map