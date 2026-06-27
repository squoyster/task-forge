import { describe, it, expect } from "vitest";
import {
  isCodeTask,
  checkCompletionEligibility,
  deriveExpectedStatus,
} from "../src/core/completion-policy.js";
import type { PullRequestVerifier } from "../src/core/completion-policy.js";
import { STATUS } from "../src/util/status-constants.js";

// ---------------------------------------------------------------------------
// Mock verifier
// ---------------------------------------------------------------------------

function createMockVerifier(overrides?: Partial<PullRequestVerifier>): PullRequestVerifier {
  return {
    checkMerged: async () => ({ merged: true, mergeCommitSha: "abc123def456" }),
    getHeadSha: async () => "headsha123456",
    checkReachable: async () => true,
    checkRequiredChecks: async () => ({ passed: true, pending: [], failing: [] }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isCodeTask
// ---------------------------------------------------------------------------

describe("isCodeTask", () => {
  it("returns true for Feature tasks", () => {
    expect(isCodeTask({ type: "Feature" })).toBe(true);
  });

  it("returns true for Bug tasks", () => {
    expect(isCodeTask({ type: "Bug" })).toBe(true);
  });

  it("returns true for Refactor tasks", () => {
    expect(isCodeTask({ type: "Refactor" })).toBe(true);
  });

  it("returns true for Test tasks", () => {
    expect(isCodeTask({ type: "Test" })).toBe(true);
  });

  it("returns true for Infrastructure tasks", () => {
    expect(isCodeTask({ type: "Infrastructure" })).toBe(true);
  });

  it("returns true for Security tasks", () => {
    expect(isCodeTask({ type: "Security" })).toBe(true);
  });

  it("returns true for Spike tasks", () => {
    expect(isCodeTask({ type: "Spike" })).toBe(true);
  });

  it("returns false for Documentation tasks", () => {
    expect(isCodeTask({ type: "Documentation" })).toBe(false);
  });

  it("returns false for Research tasks", () => {
    expect(isCodeTask({ type: "Research" })).toBe(false);
  });

  it("returns false for Release tasks", () => {
    expect(isCodeTask({ type: "Release" })).toBe(false);
  });

  it("returns false for Dependency tasks", () => {
    expect(isCodeTask({ type: "Dependency" })).toBe(false);
  });

  it("returns false for Maintenance tasks", () => {
    expect(isCodeTask({ type: "Maintenance" })).toBe(false);
  });

  it("returns false for Chore tasks", () => {
    expect(isCodeTask({ type: "Chore" })).toBe(false);
  });

  it("respects explicit code_task field override", () => {
    expect(isCodeTask({ type: "Documentation", code_task: true })).toBe(true);
    expect(isCodeTask({ type: "Feature", code_task: false })).toBe(false);
  });

  it("defaults to code-bearing for unknown types", () => {
    expect(isCodeTask({ type: "CustomType" })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkCompletionEligibility — non-code tasks
// ---------------------------------------------------------------------------

describe("checkCompletionEligibility — non-code tasks", () => {
  it("allows Documentation tasks without PR", async () => {
    const result = await checkCompletionEligibility(
      { id: "TASK-001", type: "Documentation", status: STATUS.VERIFY },
      { integrationBranch: "main" },
    );
    expect(result.eligible).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("allows Chore tasks without PR", async () => {
    const result = await checkCompletionEligibility(
      { id: "TASK-002", type: "Chore", status: STATUS.VERIFY },
      { integrationBranch: "main" },
    );
    expect(result.eligible).toBe(true);
  });

  it("includes a non-code task precondition", async () => {
    const result = await checkCompletionEligibility(
      { id: "TASK-003", type: "Documentation", status: STATUS.VERIFY },
      { integrationBranch: "main" },
    );
    expect(result.preconditions).toHaveLength(1);
    expect(result.preconditions[0].code).toBe("NON_CODE_TASK");
  });
});

// ---------------------------------------------------------------------------
// checkCompletionEligibility — code-bearing tasks
// ---------------------------------------------------------------------------

describe("checkCompletionEligibility — code-bearing tasks", () => {
  const defaultTask = {
    id: "TASK-100",
    type: "Feature",
    status: STATUS.VERIFY,
    pr: 42,
    submitted_sha: "abc123def456",
    pr_head_sha: "abc123def456",
    pr_base_branch: "main",
    pr_merged: true,
    branch: "agent/TASK-100-feature",
  };

  const defaultConfig = { integrationBranch: "main" };

  it("AC 1: rejects tasks without a PR number", async () => {
    const result = await checkCompletionEligibility(
      { ...defaultTask, pr: undefined },
      defaultConfig,
    );
    expect(result.eligible).toBe(false);
    expect(result.preconditions.some((p) => p.code === "NO_PR_RECORDED")).toBe(true);
  });

  it("AC 2: rejects PR targeting wrong base branch", async () => {
    const result = await checkCompletionEligibility(
      { ...defaultTask, pr_base_branch: "develop" },
      { ...defaultConfig, integrationBranch: "main" },
    );
    expect(result.eligible).toBe(false);
    expect(result.preconditions.some((p) => p.code === "WRONG_BASE_BRANCH")).toBe(true);
  });

  it("AC 3: accepts a recorded submitted SHA (head mismatch no longer blocks under Done-as-closeout)", async () => {
    const result = await checkCompletionEligibility(
      { ...defaultTask, pr_head_sha: "differentSHA", submitted_sha: "originalSHA" },
      defaultConfig,
    );
    expect(result.preconditions.some((p) => p.code === "SHA_MISMATCH")).toBe(false);
    expect(result.preconditions.some((p) => p.code === "SHA_RECORDED")).toBe(true);
  });

  it("AC 3: rejects when submitted SHA is missing", async () => {
    const result = await checkCompletionEligibility(
      { ...defaultTask, submitted_sha: undefined },
      defaultConfig,
    );
    expect(result.eligible).toBe(false);
    expect(result.preconditions.some((p) => p.code === "NO_SUBMITTED_SHA")).toBe(true);
  });

  it("AC 4: rejects when PR is not merged (via task metadata)", async () => {
    const result = await checkCompletionEligibility(
      { ...defaultTask, pr_merged: false },
      defaultConfig,
    );
    expect(result.eligible).toBe(false);
    expect(result.preconditions.some((p) => p.code === "PR_NOT_MERGED")).toBe(true);
  });

  it("AC 4: accepts when PR is marked merged in metadata", async () => {
    const result = await checkCompletionEligibility(
      { ...defaultTask, pr_merged: true },
      defaultConfig,
    );
    expect(result.eligible).toBe(true);
  });

  it("AC 4: verifies merge state via verifier when metadata is not set", async () => {
    const verifier = createMockVerifier({
      checkMerged: async () => ({ merged: true }),
    });
    const result = await checkCompletionEligibility(
      { ...defaultTask, pr_merged: undefined },
      { ...defaultConfig, github: { enabled: true, owner: "owner", repo: "repo" } },
      verifier,
    );
    expect(result.eligible).toBe(true);
  });

  it("AC 4: rejects merged=false returned by verifier", async () => {
    const verifier = createMockVerifier({
      checkMerged: async () => ({ merged: false }),
    });
    const result = await checkCompletionEligibility(
      { ...defaultTask, pr_merged: undefined },
      { ...defaultConfig, github: { enabled: true, owner: "owner", repo: "repo" } },
      verifier,
    );
    expect(result.eligible).toBe(false);
  });

  it("AC 5: rejects when SHA is not reachable from integration branch", async () => {
    const verifier = createMockVerifier({
      checkReachable: async () => false,
    });
    const result = await checkCompletionEligibility(
      defaultTask,
      { ...defaultConfig, github: { enabled: true, owner: "owner", repo: "repo" } },
      verifier,
    );
    expect(result.eligible).toBe(false);
    expect(result.preconditions.some((p) => p.code === "SHA_NOT_REACHABLE")).toBe(true);
  });

  it("AC 5: skips reachability check when no verifier is configured", async () => {
    const result = await checkCompletionEligibility(
      { ...defaultTask, pr_merged: true },
      defaultConfig,
    );
    // Without verifier, reachability should be skipped (passed=true with NO_VERIFIER_SKIP)
    expect(result.eligible).toBe(true);
  });

  it("AC 6: rejects when required checks fail", async () => {
    const verifier = createMockVerifier({
      checkRequiredChecks: async () => ({
        passed: false,
        pending: [],
        failing: ["lint: failure"],
      }),
    });
    const result = await checkCompletionEligibility(
      defaultTask,
      { ...defaultConfig, github: { enabled: true, owner: "owner", repo: "repo" } },
      verifier,
    );
    expect(result.eligible).toBe(false);
    expect(result.preconditions.some((p) => p.code === "CHECKS_FAILED")).toBe(true);
  });

  it("AC 6: skips checks when no verifier is configured", async () => {
    const result = await checkCompletionEligibility(
      { ...defaultTask, pr_merged: true },
      defaultConfig,
    );
    expect(result.eligible).toBe(true);
  });

  it("passes when all preconditions are satisfied", async () => {
    const verifier = createMockVerifier();
    const result = await checkCompletionEligibility(
      defaultTask,
      { ...defaultConfig, github: { enabled: true, owner: "owner", repo: "repo" } },
      verifier,
    );
    expect(result.eligible).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("suggests Review when no PR is recorded", async () => {
    const result = await checkCompletionEligibility(
      { ...defaultTask, pr: undefined },
      defaultConfig,
    );
    expect(result.suggestedStatus).toBe(STATUS.REVIEW);
  });

  it("suggests Review when PR is not merged", async () => {
    const result = await checkCompletionEligibility(
      { ...defaultTask, pr_merged: false },
      defaultConfig,
    );
    expect(result.suggestedStatus).toBe(STATUS.REVIEW);
  });

  it("returns machine-readable error codes in preconditions", async () => {
    const result = await checkCompletionEligibility(
      { id: "TASK-200", type: "Bug", status: STATUS.VERIFY, pr: undefined },
      defaultConfig,
    );
    expect(result.preconditions.length).toBeGreaterThan(0);
    for (const p of result.preconditions) {
      expect(p.code).toBeDefined();
      expect(typeof p.code).toBe("string");
      expect(p.passed).toBeDefined();
      expect(typeof p.name).toBe("string");
    }
  });

  it("handles verifier error gracefully without throwing", async () => {
    const verifier = createMockVerifier({
      checkMerged: async () => { throw new Error("API error"); },
    });
    const result = await checkCompletionEligibility(
      { ...defaultTask, pr_merged: undefined },
      { ...defaultConfig, github: { enabled: true, owner: "owner", repo: "repo" } },
      verifier,
    );
    expect(result.eligible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deriveExpectedStatus
// ---------------------------------------------------------------------------

describe("deriveExpectedStatus", () => {
  it("returns Done for done tasks", () => {
    expect(deriveExpectedStatus({ status: STATUS.DONE, branch: "agent/foo" })).toBe(STATUS.DONE);
  });

  it("returns Rejected for rejected tasks", () => {
    expect(deriveExpectedStatus({ status: STATUS.REJECTED })).toBe(STATUS.REJECTED);
  });

  it("returns Deferred for deferred tasks", () => {
    expect(deriveExpectedStatus({ status: STATUS.DEFERRED })).toBe(STATUS.DEFERRED);
  });

  it("returns Review when branch exists but no PR", () => {
    expect(deriveExpectedStatus({ status: STATUS.IN_PROGRESS, branch: "agent/foo" })).toBe(STATUS.REVIEW);
  });

  it("returns REVIEW when PR exists but not merged", () => {
    expect(deriveExpectedStatus({ status: STATUS.IN_PROGRESS, branch: "agent/foo", pr: 1, pr_merged: false })).toBe(STATUS.REVIEW);
  });

  it("returns VERIFY when PR merged but not Done", () => {
    expect(deriveExpectedStatus({ status: STATUS.IN_PROGRESS, branch: "agent/foo", pr: 1, pr_merged: true })).toBe(STATUS.VERIFY);
  });

  it("returns original status when no integration info", () => {
    expect(deriveExpectedStatus({ status: STATUS.IN_PROGRESS })).toBe(STATUS.IN_PROGRESS);
  });
});

// ---------------------------------------------------------------------------
// Full integration scenario
// ---------------------------------------------------------------------------

describe("checkCompletionEligibility — integration scenarios", () => {
  it("Scenario: pushed branch, no PR → not eligible for Done", async () => {
    const result = await checkCompletionEligibility(
      {
        id: "TASK-300",
        type: "Feature",
        status: STATUS.IN_PROGRESS,
        branch: "agent/TASK-300-feature",
        pr: undefined,
      },
      { integrationBranch: "main" },
    );
    expect(result.eligible).toBe(false);
    expect(result.suggestedStatus).toBe(STATUS.REVIEW);
  });

  it("Scenario: open PR, mergeable, checks passing → not Done (not merged)", async () => {
    const verifier = createMockVerifier({
      checkMerged: async () => ({ merged: false }),
    });
    const result = await checkCompletionEligibility(
      {
        id: "TASK-301",
        type: "Feature",
        status: STATUS.REVIEW,
        pr: 1,
        submitted_sha: "abc123",
        pr_head_sha: "abc123",
        pr_base_branch: "main",
        pr_merged: false,
        branch: "agent/TASK-301-feature",
      },
      { integrationBranch: "main", github: { enabled: true, owner: "owner", repo: "repo" } },
      verifier,
    );
    expect(result.eligible).toBe(false);
    expect(result.suggestedStatus).toBe(STATUS.REVIEW);
  });

  it("Scenario: open PR with conflicts → not Done", async () => {
    const verifier = createMockVerifier({
      checkMerged: async () => ({ merged: false }),
    });
    const result = await checkCompletionEligibility(
      {
        id: "TASK-302",
        type: "Feature",
        status: STATUS.REVIEW,
        pr: 2,
        submitted_sha: "def456",
        pr_head_sha: "def456",
        pr_base_branch: "main",
        pr_merged: false,
        branch: "agent/TASK-302-feature",
      },
      { integrationBranch: "main", github: { enabled: true, owner: "owner", repo: "repo" } },
      verifier,
    );
    expect(result.eligible).toBe(false);
  });

  it("Scenario: merged PR with recorded SHA → Done (head mismatch no longer blocks)", async () => {
    const verifier = createMockVerifier({
      checkMerged: async () => ({ merged: true }),
      checkReachable: async () => true,
    });
    const result = await checkCompletionEligibility(
      {
        id: "TASK-303",
        type: "Feature",
        status: STATUS.VERIFY,
        pr: 3,
        submitted_sha: "recordedSHA",
        pr_head_sha: "differentSHA",
        pr_base_branch: "main",
        pr_merged: true,
        branch: "agent/TASK-303-feature",
      },
      { integrationBranch: "main", github: { enabled: true, owner: "owner", repo: "repo" } },
      verifier,
    );
    expect(result.eligible).toBe(true);
  });

  it("Scenario: merged PR not targeting configured base → not Done", async () => {
    const verifier = createMockVerifier({
      checkMerged: async () => ({ merged: true }),
    });
    const result = await checkCompletionEligibility(
      {
        id: "TASK-304",
        type: "Feature",
        status: STATUS.VERIFY,
        pr: 4,
        submitted_sha: "abc123",
        pr_head_sha: "abc123",
        pr_base_branch: "develop",
        pr_merged: true,
        branch: "agent/TASK-304-feature",
      },
      { integrationBranch: "main", github: { enabled: true, owner: "owner", repo: "repo" } },
      verifier,
    );
    expect(result.eligible).toBe(false);
  });

  it("Scenario: merged PR, reachable SHA, all checks passing → Done eligible", async () => {
    const verifier = createMockVerifier({
      checkMerged: async () => ({ merged: true, mergeCommitSha: "mergeSHA" }),
      checkReachable: async () => true,
      checkRequiredChecks: async () => ({ passed: true, pending: [], failing: [] }),
    });
    const result = await checkCompletionEligibility(
      {
        id: "TASK-305",
        type: "Feature",
        status: STATUS.VERIFY,
        pr: 5,
        submitted_sha: "abc123",
        pr_head_sha: "abc123",
        pr_base_branch: "main",
        pr_merged: true,
        branch: "agent/TASK-305-feature",
      },
      { integrationBranch: "main", github: { enabled: true, owner: "owner", repo: "repo" } },
      verifier,
    );
    expect(result.eligible).toBe(true);
  });

  it("Scenario: non-code task completion without PR → Done eligible", async () => {
    const result = await checkCompletionEligibility(
      {
        id: "TASK-306",
        type: "Documentation",
        status: STATUS.IN_PROGRESS,
        branch: "agent/TASK-306-docs",
      },
      { integrationBranch: "main" },
    );
    expect(result.eligible).toBe(true);
  });
});
