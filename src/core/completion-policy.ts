/**
 * Centralized completion policy for TaskForge tasks.
 *
 * Defines the rules for when a task may transition to `Done`, including
 * PR-backed verification for code-bearing tasks.
 *
 * All commands that can mark a task complete MUST route through this module.
 * No duplicate completion logic should exist elsewhere.
 */
import { STATUS } from "../util/status-constants.js";
import type { Task } from "./task.js";
import type { Config } from "./config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of checking whether a task may complete.
 */
export interface CompletionEligibility {
  /**
   * True when the task may transition to Done.
   */
  eligible: boolean;

  /**
   * Human-readable reasons why the task cannot yet complete.
   * Empty when eligible is true.
   */
  reasons: string[];

  /**
   * Structured precondition results for machine consumption.
   */
  preconditions: PreconditionResult[];

  /**
   * Suggested next status the task should move to instead.
   * Undefined when eligible is true.
   */
  suggestedStatus?: string;
}

export interface PreconditionResult {
  name: string;
  passed: boolean;
  message: string;
  code: string;
}

/**
 * Provider interface for verifying PR integration state.
 * The first implementation uses GitHub; others may be added later.
 */
export interface PullRequestVerifier {
  /**
   * Check whether the given pull request was merged into the target base branch.
   */
  checkMerged(params: {
    owner: string;
    repo: string;
    prNumber: number;
  }): Promise<{ merged: boolean; mergeCommitSha?: string }>;

  /**
   * Get the head SHA of a pull request.
   */
  getHeadSha(params: {
    owner: string;
    repo: string;
    prNumber: number;
  }): Promise<string | null>;

  /**
   * Check whether a commit SHA is reachable from a given branch.
   */
  checkReachable(params: {
    owner: string;
    repo: string;
    sha: string;
    branch: string;
  }): Promise<boolean>;

  /**
   * Check whether required status checks have passed for a PR.
   */
  checkRequiredChecks(params: {
    owner: string;
    repo: string;
    prNumber: number;
  }): Promise<{ passed: boolean; pending: string[]; failing: string[] }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a task type is considered "code-bearing".
 *
 * Some task types (Documentation, Research, Release, etc.) may not produce
 * code changes and therefore may not need PR-based verification.
 */
export function isCodeTask(task: Pick<Task, "type" | "code_task">): boolean {
  // Explicit override via code_task field
  if (task.code_task !== undefined) return task.code_task;

  // Convention-based classification
  const nonCodeTypes = new Set([
    "Documentation",
    "Research",
    "Release",
    "Dependency",
    "Maintenance",
    "Chore",
  ]);
  return !nonCodeTypes.has(task.type ?? "Task");
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

/**
 * Check whether a task is eligible to transition to Done.
 *
 * For code-bearing tasks, the following must all hold:
 *  1. A pull request number is recorded in the task (pr field).
 *  2. The PR targets the configured integration branch.
 *  3. The PR head SHA matches the recorded submitted_sha.
 *  4. The PR has been merged.
 *  5. The submitted SHA (or resulting merge commit) is reachable from the
 *     current remote integration branch.
 *  6. Required status checks have passed.
 *
 * For non-code tasks, eligibility requires only that the task is in a state
 * that can transition to Done (checked via status-transition.ts).
 */
export async function checkCompletionEligibility(
  task: Pick<Task, "id" | "type" | "status" | "pr" | "submitted_sha" | "pr_head_sha" | "pr_base_branch" | "pr_merged" | "code_task" | "branch">,
  config: { github?: Config["github"]; integrationBranch?: string; },
  verifier?: PullRequestVerifier,
): Promise<CompletionEligibility> {
  const preconditions: PreconditionResult[] = [];
  const reasons: string[] = [];

  if (!isCodeTask(task)) {
    // Non-code tasks: just check that the transition is valid
    preconditions.push({
      name: "Non-code task policy",
      passed: true,
      message: `Task type "${task.type}" does not require PR verification`,
      code: "NON_CODE_TASK",
    });
    return { eligible: true, reasons: [], preconditions };
  }

  // Code-bearing task: run PR-backed checks
  const integrationBranch = config.integrationBranch ?? "main";

  // AC 1: PR must be recorded
  if (!task.pr) {
    preconditions.push({
      name: "PR recorded",
      passed: false,
      message: "No pull request recorded. Create a PR with 'gh pr create'",
      code: "NO_PR_RECORDED",
    });
    reasons.push("No pull request recorded");
  } else {
    preconditions.push({
      name: "PR recorded",
      passed: true,
      message: `Pull request #${task.pr} recorded`,
      code: "PR_RECORDED",
    });
  }

  // AC 2: PR must target integration branch
  if (task.pr_base_branch && task.pr_base_branch !== integrationBranch) {
    preconditions.push({
      name: "PR base branch",
      passed: false,
      message: `PR #${task.pr} targets "${task.pr_base_branch}", expected "${integrationBranch}"`,
      code: "WRONG_BASE_BRANCH",
    });
    reasons.push(`PR base branch mismatch: ${task.pr_base_branch} (expected ${integrationBranch})`);
  } else if (task.pr) {
    preconditions.push({
      name: "PR base branch",
      passed: true,
      message: `PR targets "${task.pr_base_branch ?? integrationBranch}"`,
      code: "BASE_BRANCH_OK",
    });
  }

  // AC 3: Submitted SHA recorded (Done records the PR merge commit or HEAD as
  // closeout; the old head==submitted match no longer applies under the
  // Done-as-closeout model, so only presence is required).
  if (task.pr && !task.submitted_sha) {
    preconditions.push({
      name: "Submitted SHA",
      passed: false,
      message: "Submitted SHA not recorded. Re-run 'taskforge done' to capture it.",
      code: "NO_SUBMITTED_SHA",
    });
    reasons.push("Submitted SHA not recorded");
  } else if (task.pr && task.submitted_sha) {
    preconditions.push({
      name: "Submitted SHA",
      passed: true,
      message: "Submitted SHA recorded",
      code: "SHA_RECORDED",
    });
  }

  // AC 4: PR must be merged
  if (task.pr_merged === false && task.pr) {
    preconditions.push({
      name: "PR merged",
      passed: false,
      message: `PR #${task.pr} is not merged`,
      code: "PR_NOT_MERGED",
    });
    reasons.push("Pull request not merged");
  } else if (task.pr && verifier) {
    // Verify via provider if we have one
    try {
      const { github } = config;
      if (github?.owner && github?.repo) {
        const result = await verifier.checkMerged({
          owner: github.owner,
          repo: github.repo,
          prNumber: task.pr,
        });
        if (result.merged) {
          preconditions.push({
            name: "PR merged",
            passed: true,
            message: `PR #${task.pr} is merged (merge commit: ${result.mergeCommitSha?.slice(0, 12) ?? "unknown"})`,
            code: "PR_MERGED",
          });
        } else {
          preconditions.push({
            name: "PR merged",
            passed: false,
            message: `PR #${task.pr} is not yet merged`,
            code: "PR_NOT_MERGED",
          });
          reasons.push("Pull request not merged");
        }
      }
    } catch {
      preconditions.push({
        name: "PR merged",
        passed: false,
        message: "Could not verify PR merge status",
        code: "VERIFY_ERROR",
      });
      reasons.push("Could not verify PR merge status");
    }
  } else if (task.pr_merged === true) {
    preconditions.push({
      name: "PR merged",
      passed: true,
      message: "PR marked as merged in task metadata",
      code: "PR_MERGED_RECORDED",
    });
  }

  // AC 5: SHA reachable from integration branch (PR-backed tasks only; no-PR
  // closeouts record HEAD and are not GitHub-reachability-checked).
  if (task.pr && task.submitted_sha && verifier && config.github?.owner && config.github?.repo) {
    try {
      const reachable = await verifier.checkReachable({
        owner: config.github.owner,
        repo: config.github.repo,
        sha: task.submitted_sha,
        branch: integrationBranch,
      });
      if (reachable) {
        preconditions.push({
          name: "SHA reachable",
          passed: true,
          message: `SHA ${task.submitted_sha.slice(0, 12)} reachable from ${integrationBranch}`,
          code: "SHA_REACHABLE",
        });
      } else {
        preconditions.push({
          name: "SHA reachable",
          passed: false,
          message: `SHA ${task.submitted_sha.slice(0, 12)} not reachable from ${integrationBranch}`,
          code: "SHA_NOT_REACHABLE",
        });
        reasons.push("Submitted SHA not reachable from integration branch");
      }
    } catch {
      preconditions.push({
        name: "SHA reachable",
        passed: false,
        message: "Could not verify SHA reachability",
        code: "REACHABLE_VERIFY_ERROR",
      });
      reasons.push("Could not verify SHA reachability");
    }
  } else if (task.submitted_sha && !verifier) {
    // Without a verifier, skip reachability check
    preconditions.push({
      name: "SHA reachable",
      passed: true,
      message: "No verifier configured — skipping reachability check",
      code: "NO_VERIFIER_SKIP",
    });
  }

  // AC 6: Required checks
  if (task.pr && verifier && config.github?.owner && config.github?.repo) {
    try {
      const checks = await verifier.checkRequiredChecks({
        owner: config.github.owner,
        repo: config.github.repo,
        prNumber: task.pr,
      });
      if (checks.passed) {
        preconditions.push({
          name: "Required checks",
          passed: true,
          message: "All required checks pass",
          code: "CHECKS_PASSED",
        });
      } else {
        const issues: string[] = [];
        if (checks.failing.length > 0) issues.push(`failing: ${checks.failing.join(", ")}`);
        if (checks.pending.length > 0) issues.push(`pending: ${checks.pending.join(", ")}`);
        preconditions.push({
          name: "Required checks",
          passed: false,
          message: `Checks not passing: ${issues.join("; ")}`,
          code: "CHECKS_FAILED",
        });
        reasons.push("Required checks are not passing");
      }
    } catch {
      preconditions.push({
        name: "Required checks",
        passed: false,
        message: "Could not verify required checks",
        code: "CHECKS_VERIFY_ERROR",
      });
      reasons.push("Could not verify required checks");
    }
  } else if (task.pr && !verifier) {
    preconditions.push({
      name: "Required checks",
      passed: true,
      message: "No verifier configured — skipping checks verification",
      code: "NO_VERIFIER_CHECKS_SKIP",
    });
  }

  const eligible = preconditions.every((p) => p.passed);

  // Determine suggested status based on which preconditions fail
  let suggestedStatus: string | undefined;
  if (!eligible) {
    if (!task.pr) {
      suggestedStatus = STATUS.SUBMITTED;
    } else if (task.pr_merged === false) {
      suggestedStatus = STATUS.MERGE_READY;
    } else {
      suggestedStatus = STATUS.VERIFY;
    }
  }

  return { eligible, reasons, preconditions, suggestedStatus };
}

/**
 * Determine the appropriate current status label for a task based on its
 * lifecycle stage and PR integration state.
 *
 * This is used to reconcile a task's status field against its actual
 * integration state (e.g., after a PR is merged externally).
 */
export function deriveExpectedStatus(
  task: Pick<Task, "status" | "pr" | "submitted_sha" | "pr_merged" | "branch">,
): string {
  // Terminal states stay as-is
  if (task.status === STATUS.DONE || task.status === STATUS.REJECTED || task.status === STATUS.DEFERRED) {
    return task.status;
  }

  // No PR but branch pushed → Submitted
  if (task.branch && !task.pr) {
    return STATUS.SUBMITTED;
  }

  // PR exists but not merged → Review or Merge Ready
  if (task.pr && !task.pr_merged) {
    return STATUS.REVIEW;
  }

  // PR merged but not verified → Verify
  // (Already checked Done/terminal above, so status is an active state)
  if (task.pr && task.pr_merged) {
    return STATUS.VERIFY;
  }

  return task.status;
}
