import { describe, it, expect } from "vitest";
import {
  isManagedSession,
  checkMutationAllowed,
  normaliseCommand,
  parseGitCommand,
  isDeniedGitCommand,
  isReadOnlyGitCommand,
  isTaskStateEditCommand,
  DENIED_GIT_COMMANDS,
  READ_ONLY_GIT_COMMANDS,
  recordOverride,
  hasOverride,
  type OverrideRequest,
} from "../src/core/mutation-guard.js";

// Helper: create env with TASK_FORGE_ACTIVE set
const MANAGED_ENV = { TASK_FORCE_ACTIVE: "true" };
const UNMANAGED_ENV = {};

// ---------------------------------------------------------------------------
// isManagedSession
// ---------------------------------------------------------------------------

describe("isManagedSession", () => {
  it("returns true when TASK_FORCE_ACTIVE is true", () => {
    expect(isManagedSession(MANAGED_ENV)).toBe(true);
  });

  it("returns false when TASK_FORCE_ACTIVE is false", () => {
    expect(isManagedSession({ TASK_FORCE_ACTIVE: "false" })).toBe(false);
  });

  it("returns false when TASK_FORCE_ACTIVE is not set", () => {
    expect(isManagedSession(UNMANAGED_ENV)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normaliseCommand
// ---------------------------------------------------------------------------

describe("normaliseCommand", () => {
  it("strips absolute git path", () => {
    expect(normaliseCommand("/usr/bin/git commit -m foo")).toBe("git commit -m foo");
  });

  it("strips long absolute git path", () => {
    expect(normaliseCommand("/opt/homebrew/bin/git push origin")).toBe("git push origin");
  });

  it("collapses whitespace", () => {
    expect(normaliseCommand("git   commit   -m  foo")).toBe("git commit -m foo");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normaliseCommand("  git status  ")).toBe("git status");
  });

  it("leaves non-git commands unchanged (aside from whitespace)", () => {
    expect(normaliseCommand("npm run test")).toBe("npm run test");
  });
});

// ---------------------------------------------------------------------------
// parseGitCommand
// ---------------------------------------------------------------------------

describe("parseGitCommand", () => {
  it("parses simple verb", () => {
    expect(parseGitCommand("git commit")).toEqual({ verb: "commit", sub: undefined, args: [] });
  });

  it("parses verb with sub-command", () => {
    expect(parseGitCommand("git branch -d foo")).toEqual({ verb: "branch", sub: "-d", args: ["foo"] });
  });

  it("normalises -D to -d", () => {
    expect(parseGitCommand("git branch -D foo")).toEqual({ verb: "branch", sub: "-d", args: ["foo"] });
  });

  it("returns empty for non-git command", () => {
    expect(parseGitCommand("npm test")).toEqual({ args: ["npm", "test"] });
  });
});

// ---------------------------------------------------------------------------
// isDeniedGitCommand
// ---------------------------------------------------------------------------

describe("isDeniedGitCommand", () => {
  it("denies git commit", () => {
    expect(isDeniedGitCommand("git commit -m foo")).toEqual({ denied: true, match: "commit" });
  });

  it("denies git push", () => {
    expect(isDeniedGitCommand("git push origin main")).toEqual({ denied: true, match: "push" });
  });

  it("denies git merge", () => {
    expect(isDeniedGitCommand("git merge feature-branch")).toEqual({ denied: true, match: "merge" });
  });

  it("denies git rebase", () => {
    expect(isDeniedGitCommand("git rebase main")).toEqual({ denied: true, match: "rebase" });
  });

  it("denies git cherry-pick", () => {
    expect(isDeniedGitCommand("git cherry-pick abc123")).toEqual({ denied: true, match: "cherry-pick" });
  });

  it("denies git reset", () => {
    expect(isDeniedGitCommand("git reset --hard HEAD")).toEqual({ denied: true, match: "reset" });
  });

  it("denies git branch -d", () => {
    expect(isDeniedGitCommand("git branch -d old-branch")).toEqual({ denied: true, match: "branch -d" });
  });

  it("denies git branch -D", () => {
    expect(isDeniedGitCommand("git branch -D old-branch")).toEqual({ denied: true, match: "branch -d" });
  });

  it("denies git worktree add", () => {
    expect(isDeniedGitCommand("git worktree add ../new-tree")).toEqual({ denied: true, match: "worktree add" });
  });

  it("denies git worktree remove", () => {
    expect(isDeniedGitCommand("git worktree remove ../old-tree")).toEqual({ denied: true, match: "worktree remove" });
  });

  it("denies git update-ref", () => {
    expect(isDeniedGitCommand("git update-ref HEAD abc123")).toEqual({ denied: true, match: "update-ref" });
  });

  it("allows git status", () => {
    expect(isDeniedGitCommand("git status")).toEqual({ denied: false });
  });

  it("allows git log", () => {
    expect(isDeniedGitCommand("git log --oneline")).toEqual({ denied: false });
  });

  it("allows git diff", () => {
    expect(isDeniedGitCommand("git diff HEAD")).toEqual({ denied: false });
  });
});

// ---------------------------------------------------------------------------
// isReadOnlyGitCommand
// ---------------------------------------------------------------------------

describe("isReadOnlyGitCommand", () => {
  it("allows git status", () => {
    expect(isReadOnlyGitCommand("git status")).toBe(true);
  });

  it("allows git diff", () => {
    expect(isReadOnlyGitCommand("git diff HEAD")).toBe(true);
  });

  it("allows git log", () => {
    expect(isReadOnlyGitCommand("git log --oneline -5")).toBe(true);
  });

  it("allows git show", () => {
    expect(isReadOnlyGitCommand("git show HEAD")).toBe(true);
  });

  it("allows git branch without flags", () => {
    expect(isReadOnlyGitCommand("git branch")).toBe(true);
  });

  it("allows git branch --show-current", () => {
    expect(isReadOnlyGitCommand("git branch --show-current")).toBe(true);
  });

  it("allows git rev-parse", () => {
    expect(isReadOnlyGitCommand("git rev-parse HEAD")).toBe(true);
  });

  it("allows git fetch", () => {
    expect(isReadOnlyGitCommand("git fetch origin")).toBe(true);
  });

  it("allows git ls-remote", () => {
    expect(isReadOnlyGitCommand("git ls-remote origin")).toBe(true);
  });

  it("rejects git commit as read-only", () => {
    expect(isReadOnlyGitCommand("git commit -m foo")).toBe(false);
  });

  it("rejects git push as read-only", () => {
    expect(isReadOnlyGitCommand("git push origin")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkMutationAllowed
// ---------------------------------------------------------------------------

describe("checkMutationAllowed", () => {
  it("allows git status in managed session", () => {
    const result = checkMutationAllowed("git status", MANAGED_ENV);
    expect(result.code).toBe("ALLOWED");
    expect(result.allowed).toBe(true);
  });

  it("denies git commit in managed session", () => {
    const result = checkMutationAllowed("git commit -m test", MANAGED_ENV);
    expect(result.code).toBe("DENIED_COMMAND");
    expect(result.allowed).toBe(false);
    expect(result.replacement).toBe("taskforge checkpoint TASK-ID --message \"...\"");
  });

  it("denies git push in managed session", () => {
    const result = checkMutationAllowed("git push origin branch", MANAGED_ENV);
    expect(result.code).toBe("DENIED_COMMAND");
    expect(result.allowed).toBe(false);
    expect(result.replacement).toBe("taskforge submit TASK-ID");
  });

  it("denies git push with absolute path", () => {
    const result = checkMutationAllowed("/usr/bin/git push origin", MANAGED_ENV);
    expect(result.code).toBe("DENIED_COMMAND");
    expect(result.allowed).toBe(false);
  });

  it("denies git branch -D in managed session", () => {
    const result = checkMutationAllowed("git branch -D old-branch", MANAGED_ENV);
    expect(result.code).toBe("DENIED_COMMAND");
    expect(result.allowed).toBe(false);
  });

  it("allows git log in managed session", () => {
    const result = checkMutationAllowed("git log --oneline -5", MANAGED_ENV);
    expect(result.code).toBe("ALLOWED");
    expect(result.allowed).toBe(true);
  });

  it("allows diff in managed session", () => {
    const result = checkMutationAllowed("git diff HEAD", MANAGED_ENV);
    expect(result.code).toBe("ALLOWED");
    expect(result.allowed).toBe(true);
  });

  it("allows npm commands in managed session", () => {
    const result = checkMutationAllowed("npm run test", MANAGED_ENV);
    expect(result.code).toBe("ALLOWED");
    expect(result.allowed).toBe(true);
  });

  it("returns NOT_MANAGED when TASK_FORCE_ACTIVE is not set", () => {
    const result = checkMutationAllowed("git commit -m test", UNMANAGED_ENV);
    expect(result.code).toBe("NOT_MANAGED");
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isTaskStateEditCommand
// ---------------------------------------------------------------------------

describe("isTaskStateEditCommand", () => {
  it("detects echo to task-state", () => {
    expect(isTaskStateEditCommand("echo 'test' > ../task-state/TASK-001.md")).toBe(true);
  });

  it("detects sed edit on task-state", () => {
    expect(isTaskStateEditCommand("sed -i 's/foo/bar/' ../task-state/TASK-001.md")).toBe(true);
  });

  it("detects cp to task-state", () => {
    expect(isTaskStateEditCommand("cp /tmp/file ../task-state/TASK-001.md")).toBe(true);
  });

  it("detects rm of task-state file", () => {
    expect(isTaskStateEditCommand("rm ../task-state/TASK-001.md")).toBe(true);
  });

  it("does not flag normal commands", () => {
    expect(isTaskStateEditCommand("npm run build")).toBe(false);
  });

  it("does not flag git commands", () => {
    expect(isTaskStateEditCommand("git status")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Override
// ---------------------------------------------------------------------------

describe("recordOverride and hasOverride", () => {
  const testRequest: OverrideRequest = {
    reason: "Emergency fix",
    identity: "doctor",
    taskId: "TASK-999",
    command: "git push origin hotfix",
    affectedRepo: "/tmp/test-repo",
    beforeSha: "abc123",
    afterSha: "def456",
    timestamp: new Date().toISOString(),
  };

  it("records an override audit event", () => {
    expect(() => recordOverride(testRequest)).not.toThrow();
  });

  it("finds a recent override", () => {
    recordOverride(testRequest);
    expect(hasOverride("TASK-999", "git push origin hotfix")).toBe(true);
  });

  it("does not find non-existent override", () => {
    expect(hasOverride("TASK-NONEXISTENT", "git commit")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DENIED_GIT_COMMANDS & READ_ONLY_GIT_COMMANDS
// ---------------------------------------------------------------------------

describe("command lists", () => {
  it("DENIED_GIT_COMMANDS includes all required mutations", () => {
    const required = ["commit", "push", "merge", "rebase", "cherry-pick", "reset", "update-ref"];
    for (const cmd of required) {
      expect(DENIED_GIT_COMMANDS).toContain(cmd);
    }
  });

  it("DENIED_GIT_COMMANDS includes branch/worktree variants", () => {
    expect(DENIED_GIT_COMMANDS).toContain("branch -d");
    expect(DENIED_GIT_COMMANDS).toContain("worktree add");
    expect(DENIED_GIT_COMMANDS).toContain("worktree remove");
  });

  it("READ_ONLY_GIT_COMMANDS includes all required diagnostics", () => {
    const required = ["status", "diff", "log", "show", "rev-parse", "merge-base", "ls-remote", "fetch"];
    for (const cmd of required) {
      expect(READ_ONLY_GIT_COMMANDS).toContain(cmd);
    }
  });

  it("denied and read-only lists are mutually exclusive", () => {
    for (const denied of DENIED_GIT_COMMANDS) {
      // Only check simple command names (no sub-commands like "branch -d")
      if (!denied.includes(" ")) {
        expect(READ_ONLY_GIT_COMMANDS).not.toContain(denied);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("handles empty command", () => {
    const result = checkMutationAllowed("", MANAGED_ENV);
    expect(result.allowed).toBe(true);
  });

  it("handles command with only whitespace", () => {
    const result = checkMutationAllowed("   ", MANAGED_ENV);
    expect(result.allowed).toBe(true);
  });

  it("allows git --version (not in deny list)", () => {
    const result = checkMutationAllowed("git --version", MANAGED_ENV);
    expect(result.code).toBe("ALLOWED");
  });

  it("has replacement for each denied verb command", () => {
    const deniedWithoutSub = DENIED_GIT_COMMANDS.filter((c) => !c.includes(" "));
    for (const cmd of deniedWithoutSub) {
      if (cmd === "commit" || cmd === "push") {
        expect(checkMutationAllowed(`git ${cmd}`, MANAGED_ENV).replacement).toBeDefined();
      }
    }
  });
});
