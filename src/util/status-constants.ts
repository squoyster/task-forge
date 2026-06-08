import { z } from "zod";

export const STATUS = {
  INBOX: "Inbox",
  NEEDS_SPEC: "Needs Spec",
  READY: "Ready",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  IMPLEMENTATION_COMPLETE: "Implementation Complete",
  SUBMITTED: "Submitted",
  REVIEW: "Review",
  MERGE_READY: "Merge Ready",
  VERIFY: "Verify",
  DONE: "Done",
  REJECTED: "Rejected",
  DEFERRED: "Deferred",
} as const;

export const ALL_STATUSES: readonly string[] = Object.values(STATUS);

export const ACTIVE_STATUSES = [
  STATUS.READY,
  STATUS.IN_PROGRESS,
  STATUS.IMPLEMENTATION_COMPLETE,
  STATUS.SUBMITTED,
  STATUS.REVIEW,
  STATUS.MERGE_READY,
  STATUS.VERIFY,
] as const;

export const TERMINAL_STATUSES = [STATUS.DONE, STATUS.REJECTED, STATUS.DEFERRED] as const;

type StatusKey = keyof typeof STATUS;
type StatusValue = (typeof STATUS)[StatusKey];

/**
 * Normalize status input to canonical form.
 * Accepts common variants and returns the canonical human-readable value.
 *
 * | Input | Output |
 * |---|---|
 * | "In Progress" | "In Progress" |
 * | "in_progress" | "In Progress" |
 * | "in-progress" | "In Progress" |
 * | "in progress" | "In Progress" |
 * | "InProgress" | "In Progress" |
 * | "needs_spec" | "Needs Spec" |
 * | "NeedsSpec" | "Needs Spec" |
 * | "ready" | "Ready" |
 * | "done" | "Done" |
 */
export function normalizeStatus(input: string): string {
  const trimmed = input.trim();

  // Exact match — return as-is
  if (ALL_STATUSES.includes(trimmed)) {
    return trimmed;
  }

  // Normalize: convert to lowercase for comparison
  const lower = trimmed.toLowerCase();

  // Map of normalized forms to canonical values
  const variantMap: Record<string, StatusValue> = {
    // In Progress variants
    "in_progress": STATUS.IN_PROGRESS,
    "in-progress": STATUS.IN_PROGRESS,
    "in progress": STATUS.IN_PROGRESS,
    "inprogress": STATUS.IN_PROGRESS,

    // Needs Spec variants
    "needs_spec": STATUS.NEEDS_SPEC,
    "needsspec": STATUS.NEEDS_SPEC,
    "needs spec": STATUS.NEEDS_SPEC,

    // Ready variants
    "ready": STATUS.READY,

    // Blocked variants
    "blocked": STATUS.BLOCKED,

    // Implementation Complete variants
    "implementation_complete": STATUS.IMPLEMENTATION_COMPLETE,
    "implementation-complete": STATUS.IMPLEMENTATION_COMPLETE,
    "implementation complete": STATUS.IMPLEMENTATION_COMPLETE,
    "implcomplete": STATUS.IMPLEMENTATION_COMPLETE,

    // Submitted variants
    "submitted": STATUS.SUBMITTED,

    // Review variants
    "review": STATUS.REVIEW,

    // Merge Ready variants
    "merge_ready": STATUS.MERGE_READY,
    "merge-ready": STATUS.MERGE_READY,
    "merge ready": STATUS.MERGE_READY,

    // Verify variants
    "verify": STATUS.VERIFY,

    // Done variants
    "done": STATUS.DONE,

    // Rejected variants
    "rejected": STATUS.REJECTED,

    // Deferred variants
    "deferred": STATUS.DEFERRED,

    // Inbox variants
    "inbox": STATUS.INBOX,
  };

  // Also handle camelCase variants like "InProgress", "NeedsSpec"
  const camelCaseMap: Record<string, StatusValue> = {
    "InProgress": STATUS.IN_PROGRESS,
    "NeedsSpec": STATUS.NEEDS_SPEC,
    "ImplementationComplete": STATUS.IMPLEMENTATION_COMPLETE,
    "MergeReady": STATUS.MERGE_READY,
  };

  if (variantMap[lower]) {
    return variantMap[lower];
  }

  if (camelCaseMap[trimmed]) {
    return camelCaseMap[trimmed];
  }

  // Return the original value - let Zod enum validation catch invalid values
  return trimmed;
}

/**
 * Zod preprocessor that normalizes status input before validating against TaskStatus.
 */
export function createStatusSchema() {
  return z.preprocess(
    (val) => {
      if (typeof val !== "string") return val;
      return normalizeStatus(val);
    },
    z.enum([STATUS.INBOX, STATUS.NEEDS_SPEC, STATUS.READY, STATUS.IN_PROGRESS, STATUS.BLOCKED, STATUS.IMPLEMENTATION_COMPLETE, STATUS.SUBMITTED, STATUS.REVIEW, STATUS.MERGE_READY, STATUS.VERIFY, STATUS.DONE, STATUS.REJECTED, STATUS.DEFERRED]),
  );
}
