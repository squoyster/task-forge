import { STATUS } from "../util/status-constants.js";

const TRANSITIONS: Record<string, string[]> = {
  [STATUS.INBOX]: [STATUS.NEEDS_SPEC, STATUS.REJECTED],
  [STATUS.NEEDS_SPEC]: [STATUS.READY, STATUS.DEFERRED],
  [STATUS.READY]: [STATUS.IN_PROGRESS, STATUS.BLOCKED, STATUS.DEFERRED],
  [STATUS.IN_PROGRESS]: [
    STATUS.IMPLEMENTATION_COMPLETE,
    STATUS.BLOCKED,
    STATUS.DEFERRED,
  ],
  [STATUS.BLOCKED]: [STATUS.READY, STATUS.IN_PROGRESS],
  [STATUS.IMPLEMENTATION_COMPLETE]: [
    STATUS.IN_PROGRESS,
    STATUS.SUBMITTED,
    STATUS.REVIEW,
    STATUS.BLOCKED,
    STATUS.DEFERRED,
  ],
  [STATUS.SUBMITTED]: [
    STATUS.IMPLEMENTATION_COMPLETE,
    STATUS.REVIEW,
    STATUS.MERGE_READY,
    STATUS.BLOCKED,
    STATUS.DEFERRED,
  ],
  [STATUS.REVIEW]: [
    STATUS.SUBMITTED,
    STATUS.MERGE_READY,
    STATUS.BLOCKED,
    STATUS.DEFERRED,
  ],
  [STATUS.MERGE_READY]: [
    STATUS.REVIEW,
    STATUS.VERIFY,
    STATUS.BLOCKED,
    STATUS.DEFERRED,
  ],
  [STATUS.VERIFY]: [
    STATUS.MERGE_READY,
    STATUS.DONE,
    STATUS.BLOCKED,
    STATUS.DEFERRED,
  ],
  [STATUS.DONE]: [STATUS.IN_PROGRESS],
  [STATUS.REJECTED]: [],
  [STATUS.DEFERRED]: [STATUS.READY],
};

export function isValidTransition(
  from: string,
  to: string,
): boolean {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function getAllowedTransitions(from: string): string[] {
  return TRANSITIONS[from] ?? [];
}

export function validateTransition(
  from: string,
  to: string,
): string | null {
  if (isValidTransition(from, to)) return null;
  const allowed = getAllowedTransitions(from);
  if (allowed.length === 0) {
    return `Cannot transition from "${from}" — terminal state`;
  }
  return `Cannot transition from "${from}" to "${to}". Allowed: ${allowed.join(", ")}`;
}
