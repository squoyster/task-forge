import { z } from "zod";

/**
 * Canonical task status graph (TF-SIMP-02).
 *
 *   Inbox -> Needs Spec -> Ready -> In Progress -> Review -> Verify -> Done
 *
 * Blocked is reachable from Ready/In Progress. Deferred returns to Ready.
 * Rejected is terminal. Legacy transport statuses (Implementation Complete,
 * Submitted, Merge Ready) are normalized away at the schema boundary:
 *   Implementation Complete -> Review
 *   Submitted               -> Review
 *   Merge Ready             -> Verify
 *
 * Git/PR transport facts live as metadata (submitted_sha, pr, pr_merged), never
 * re-encoded as a status.
 */
export const STATUS = {
  INBOX: "Inbox",
  NEEDS_SPEC: "Needs Spec",
  READY: "Ready",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  REVIEW: "Review",
  VERIFY: "Verify",
  DONE: "Done",
  REJECTED: "Rejected",
  DEFERRED: "Deferred",
} as const;

export const ALL_STATUSES: readonly string[] = Object.values(STATUS);

export const ACTIVE_STATUSES = [
  STATUS.READY,
  STATUS.IN_PROGRESS,
  STATUS.REVIEW,
  STATUS.VERIFY,
] as const;

export const TERMINAL_STATUSES = [STATUS.DONE, STATUS.REJECTED, STATUS.DEFERRED] as const;

type StatusKey = keyof typeof STATUS;
type StatusValue = (typeof STATUS)[StatusKey];

/**
 * Normalize status input to canonical form.
 * Accepts common variants AND the three legacy transport statuses, returning
 * the canonical human-readable value.
 *
 * | Input | Output |
 * |---|---|
 * | "In Progress" | "In Progress" |
 * | "in_progress" | "In Progress" |
 * | "in-progress" | "In Progress" |
 * | "InProgress" | "In Progress" |
 * | "needs_spec" | "Needs Spec" |
 * | "NeedsSpec" | "Needs Spec" |
 * | "ready" | "Ready" |
 * | "done" | "Done" |
 * | "Implementation Complete" | "Review" (legacy) |
 * | "Submitted" | "Review" (legacy) |
 * | "Merge Ready" | "Verify" (legacy) |
 */
export function normalizeStatus(input: string): string {
  const trimmed = input.trim();

  // Exact match — return as-is
  if (ALL_STATUSES.includes(trimmed)) {
    return trimmed;
  }

  // Normalize: convert to lowercase for comparison
  const lower = trimmed.toLowerCase();

  // Map of normalized forms to canonical values.
  // Legacy transport statuses map to their canonical replacement.
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

    // Review variants
    "review": STATUS.REVIEW,

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

    // Legacy: Implementation Complete -> Review
    "implementation_complete": STATUS.REVIEW,
    "implementation-complete": STATUS.REVIEW,
    "implementation complete": STATUS.REVIEW,
    "implcomplete": STATUS.REVIEW,

    // Legacy: Submitted -> Review
    "submitted": STATUS.REVIEW,

    // Legacy: Merge Ready -> Verify
    "merge_ready": STATUS.VERIFY,
    "merge-ready": STATUS.VERIFY,
    "merge ready": STATUS.VERIFY,
    "mergeready": STATUS.VERIFY,
  };

  // Also handle camelCase variants like "InProgress", "NeedsSpec".
  // Legacy camelCase forms also map to their canonical replacement.
  const camelCaseMap: Record<string, StatusValue> = {
    "InProgress": STATUS.IN_PROGRESS,
    "NeedsSpec": STATUS.NEEDS_SPEC,
    // Legacy camelCase
    "ImplementationComplete": STATUS.REVIEW,
    "MergeReady": STATUS.VERIFY,
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
 * Zod preprocessor that normalizes status input before validating against the
 * canonical TaskStatus enum. Legacy statuses are accepted and normalized, so
 * existing task files load and the next write persists a canonical value.
 */
export function createStatusSchema() {
  return z.preprocess(
    (val) => {
      if (typeof val !== "string") return val;
      return normalizeStatus(val);
    },
    z.enum([
      STATUS.INBOX,
      STATUS.NEEDS_SPEC,
      STATUS.READY,
      STATUS.IN_PROGRESS,
      STATUS.BLOCKED,
      STATUS.REVIEW,
      STATUS.VERIFY,
      STATUS.DONE,
      STATUS.REJECTED,
      STATUS.DEFERRED,
    ]),
  );
}
