import { describe, it, expect } from "vitest";
import {
  claimStateMachine,
  startStateMachine,
  gatesStateMachine,
  unhandledError,
  ClaimStates,
  StartStates,
} from "../src/core/command-states.js";

describe("claimStateMachine — no force/start guidance", () => {
  it("does not recommend 'taskforge start' on success with worktree", () => {
    const result = claimStateMachine({
      taskFound: true,
      taskStatus: "Ready",
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: true,
      worktreeExists: true,
      worktreePath: "/tmp/worktree/TASK-001",
      taskId: "TASK-001",
      sessionId: "abc123",
    });

    expect(result.ok).toBe(true);
    expect(result.state).toBe(ClaimStates.TASK_CLAIMED);
    // Should NOT tell agent to run start as a next command
    expect(result.guidance).not.toMatch(/Run 'taskforge start/i);
    expect(result.guidance).toContain("cd /tmp/worktree/TASK-001");
  });

  it("does not recommend 'taskforge start' on success without worktree", () => {
    const result = claimStateMachine({
      taskFound: true,
      taskStatus: "Ready",
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: true,
      worktreeExists: false,
      taskId: "TASK-001",
      sessionId: "abc123",
    });

    expect(result.ok).toBe(true);
    expect(result.state).toBe(ClaimStates.TASK_CLAIMED);
    // Should NOT recommend start as a positive next command.
    // The guidance may say "Do NOT run 'taskforge start'" which is a warning — that's fine.
    // We check that there's no positive "Run 'taskforge start" without "Do NOT" preceding it.
    const hasPositiveStartRecommendation = /(?<!Do NOT )Run 'taskforge start/i.test(result.guidance);
    expect(hasPositiveStartRecommendation).toBe(false);
    // Should explicitly warn against it
    expect(result.guidance).toContain("Do NOT run");
    expect(result.guidance).toContain("taskforge doctor");
    expect(result.guidance).toContain("taskforge block");
  });

  it("does not recommend --force as a valid action on already-claimed error", () => {
    const result = claimStateMachine({
      taskFound: true,
      taskStatus: "Ready",
      taskAssignee: "other-session",
      taskClaimedAt: "2026-05-28 01:00:00",
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId: "TASK-001",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("ALREADY_CLAIMED");
    // Should NOT recommend using --force (it may say "may not use")
    expect(result.guidance).not.toMatch(/use 'taskforge.*--force'/i);
    expect(result.guidance).not.toMatch(/use.*--force.*to override/i);
    // Should explicitly say agents may not use it
    expect(result.guidance).toContain("Normal agents may not use --force");
    expect(result.guidance).toContain("taskforge doctor");
    expect(result.guidance).toContain("taskforge block");
  });
});

describe("startStateMachine — no force guidance", () => {
  it("does not recommend --force as a valid action on already-assigned error", () => {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: "In Progress",
      taskAssignee: "other-session",
      taskClaimedAt: "2026-05-28 01:00:00",
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: true,
      worktreeCreated: false,
      taskId: "TASK-001",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("ALREADY_ASSIGNED");
    // Should NOT recommend using --force (it may say "may not use")
    expect(result.guidance).not.toMatch(/use 'taskforge.*--force'/i);
    expect(result.guidance).not.toMatch(/use.*--force.*to override/i);
    expect(result.guidance).not.toMatch(/use.*--force.*if.*stale/i);
    // Should explicitly say agents may not use it
    expect(result.guidance).toContain("Normal agents may not use --force");
    expect(result.guidance).toContain("taskforge resume");
    expect(result.guidance).toContain("taskforge doctor");
    expect(result.guidance).toContain("taskforge block");
  });

  it("does not recommend --force on push failure", () => {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: "Ready",
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId: "TASK-001",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("PUSH_FAILED");
    expect(result.guidance).not.toMatch(/--force/i);
    expect(result.guidance).toContain("taskforge next");
    expect(result.guidance).toContain("retry");
  });

  it("succeeds with worktree guidance on happy path", () => {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: "Ready",
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: true,
      worktreeCreated: true,
      worktreePath: "/tmp/worktree/TASK-001",
      branch: "agent/TASK-001-test",
      taskId: "TASK-001",
      sessionId: "abc123",
    });

    expect(result.ok).toBe(true);
    expect(result.state).toBe(StartStates.TASK_STARTED);
    expect(result.guidance).toContain("cd /tmp/worktree/TASK-001");
  });
});

describe("gatesStateMachine — no done --force guidance", () => {
  it("does not recommend 'done --force' on gate failure", () => {
    const result = gatesStateMachine({
      totalGates: 3,
      passedGates: 1,
      failedGates: [
        { name: "lint", command: "npm run lint" },
        { name: "test", command: "npm test" },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("GATE_FAILURE");
    expect(result.guidance).not.toMatch(/done --force/i);
    expect(result.guidance).toContain("Fix the issues");
    expect(result.guidance).toContain("request human input");
  });
});

describe("unhandledError — closure task guidance", () => {
  it("includes a safe taskforge new command in guidance", () => {
    const result = unhandledError("start", "branch exists during start", {
      branch: "agent/TASK-123",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("UNHANDLED_ERROR");
    expect(result.guidance).toContain("taskforge new");
    expect(result.guidance).toContain("Handle unclosed TaskForge error: branch exists during start");
    expect(result.guidance).toContain("If the correct action cannot be cleanly inferred, request human input.");
  });
});
